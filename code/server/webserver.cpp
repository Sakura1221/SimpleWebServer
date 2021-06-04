#include "webserver.h"

using namespace std;

//服务器相关参数包括连接参数、数据库参数、线程池参数、日志参数
WebServer::WebServer(
    int port, int trigMode, int timeoutMs, bool optLinger,
    int sqlPort, const char* sqlUser, const char* sqlPwd,
    const char* dbName, int connPoolNum,
    int threadNum, int maxRequests,
    bool openLog, int logLevel, int logQueSize):
    port(port), openLinger(optLinger), timeoutMs(timeoutMs), shutdown(false),
    timer(new HeapTimer()), epoller(new Epoller())
{
    //内部调用malloc动态分配缓存
    srcDir = getcwd(nullptr, 256);
    assert(srcDir);
    strncat(srcDir, "/resources/", 16);
    HttpConnect::userCnt = 0;
    HttpConnect::srcDir = srcDir;
    //线程池唯一实例初始化
    ThreadPool::instance()->init(threadNum, maxRequests);
    //连接池唯一实例初始化
    SqlConnPool::instance()->init("localhost", sqlPort, sqlUser, sqlPwd, dbName, connPoolNum);
    //设置不同套接字的触发模式
    initEventMode(trigMode);
    if (!initSocket()) shutdown = true;

    //初始化日志实例
    if(openLog) {
        Log::instance()->init(logLevel, "./log", ".log", logQueSize);
        if(shutdown) { LOG_ERROR("========== Server init error!=========="); }
        else {
            LOG_INFO("========== Server init ==========");
            LOG_INFO("Port:%d, OpenLinger: %s", port, optLinger? "true":"false");
            LOG_INFO("Listen Mode: %s, OpenConn Mode: %s",
                            (listenEvent & EPOLLET ? "ET": "LT"),
                            (connEvent & EPOLLET ? "ET": "LT"));
            LOG_INFO("LogSys level: %d", logLevel);
            LOG_INFO("srcDir: %s", HttpConnect::srcDir);
            LOG_INFO("SqlConnPool num: %d, ThreadPool num: %d", connPoolNum, threadNum);
        }
    }
}

WebServer::~WebServer()
{
    //回收监听套接字
    close(listenfd);
    shutdown = true;
    //回收路径动态缓存
    free(srcDir);
    //关闭数据库连接池
    SqlConnPool::instance()->destroy();
}

/* 设置不同套接字的触发模式 */
void WebServer::initEventMode(int trigMode)
{
    //监听事件：仅为了初始化，无作用
    listenEvent = EPOLLRDHUP;
    //连接事件：对端断开，并设置oneshot
    connEvent = EPOLLONESHOT | EPOLLRDHUP;
    switch (trigMode)
    {
    case 0:
        break;
    case 1:
        connEvent |= EPOLLET;
        break;
    case 2:
        listenEvent |= EPOLLET;
        break;
    case 3:
        listenEvent |= EPOLLET;
        connEvent |= EPOLLET;
        break;
    default:
        listenEvent |= EPOLLET;
        connEvent |= EPOLLET;
        break;
    }
    //用&判断连接套接字是否为ET触发模式
    HttpConnect::isET = (connEvent & EPOLLET);
}

/* epoll循环监听事件，根据事件类型调用相应方法 */
//延迟计算思想，方法及参数会被打包放到线程池的任务队列中
void WebServer::start()
{
    int timeMs = -1;
    if (!shutdown) {LOG_INFO("========= Server start =========");}
    while (!shutdown)
    {
        //返回下一个计时器超时的时间
        if (timeoutMs > 0)
            timeMs = timer->getNextTick();
        /* 利用epoll的time_wait实现定时功能 */
        //在计时器超时前唤醒一次epoll，判断是否有新事件到达
        //如果没有新事件，下次调用getNextTick时，会将超时的堆顶计时器删除
        int eventCnt = epoller->wait(timeMs);
        //遍历事件表
        for (int i = 0; i < eventCnt; i ++)
        {
            //事件套接字
            int fd = epoller->getEventfd(i);
            //事件内容
            uint32_t events = epoller->getEvents(i);
            //监听套接字只有连接事件
            if (fd == listenfd) dealListen();
            //连接套接字几种事件
            //对端关闭连接
            else if (events & (EPOLLRDHUP | EPOLLHUP | EPOLLERR))
            {
                assert(users.count(fd) > 0);
                closeConnect(&users[fd]);
            }
            //读事件
            else if (events & EPOLLIN)
            {
                assert(users.count(fd) > 0);
                dealRead(&users[fd]);
            }
            //写事件
            else if (events & EPOLLOUT)
            {
                assert(users.count(fd) > 0);
                dealWrite(&users[fd]);
            }
            else
            {
                LOG_ERROR("Unexpected event");
            }
        }
    }
}

/* 发送错误 */
void WebServer::sendError(int fd, const char* info)
{
    assert(fd > 0);
    int ret = send(fd, info, strlen(info), 0);
    if (ret < 0)
    {
        LOG_WARN("send error to client[%d] error!", fd);
    }
    close(fd);
}

/* 关闭连接套接字，并从epoll事件表中删除相应事件 */
void WebServer::closeConnect(HttpConnect* client)
{
    assert(client);
    LOG_INFO("Client[%d] quit!", client->getfd());
    epoller->delfd(client->getfd());
    client->closeConnect();
}

/* 为连接注册事件和设置计时器 */
void WebServer::addClient(int fd, sockaddr_in addr)
{
    assert(fd > 0);
    //users是哈希表，套接字是键，HttpConnect对象是值
    //将fd和连接地址传入,初始化HttpConnect对象，用client表示
    users[fd].init(fd, addr);
    //添加计时器，到期关闭连接
    if(timeoutMs > 0)
    {
        timer->add(fd, timeoutMs, bind(&WebServer::closeConnect, this, &users[fd]));
    }
    epoller->addfd(fd, EPOLLIN | connEvent);
    //套接字设置非阻塞
    setfdNonblock(fd);
    LOG_INFO("Client[%d] in!", users[fd].getfd());
}

/* 新建连接套接字，ET模式会一次将连接队列读完 */
void WebServer::dealListen()
{
    struct sockaddr_in addr;
    socklen_t len = sizeof(addr);
    do
    {
        int fd = accept(listenfd, (struct sockaddr*)&addr, &len);
        if (fd <= 0) return;
        if (HttpConnect::userCnt >= MAX_FD)
        {
            sendError(fd, "Server busy!");
            LOG_WARN("Clients is full!");
            return;
        }
        addClient(fd, addr);
    } while (listenEvent & EPOLLET);
}

/* 将读函数和参数用std::bind绑定，加入线程池的任务队列 */
void WebServer::dealRead(HttpConnect* client)
{
    assert(client);
    extentTime(client);
    //非静态成员函数需要传递this指针作为第一个参数
    ThreadPool::instance()->addTask(std::bind(&WebServer::onRead, this, client));
}

/* 将写吧函数和参数用std::bind绑定，加入线程池的任务队列 */
void WebServer::dealWrite(HttpConnect* client)
{
    assert(client);
    extentTime(client);
    //非静态成员函数需要传递this指针作为第一个参数
    ThreadPool::instance()->addTask(std::bind(&WebServer::onWrite, this, client));
}

//重置计时器
void WebServer::extentTime(HttpConnect* client)
{
    assert(client);
    if (timeoutMs > 0)
        timer->adjust(client->getfd(), timeoutMs);
}

/* 读函数：先接收再处理 */
void WebServer::onRead(HttpConnect* client)
{
    assert(client);
    int ret = -1;
    int readErrno = 0;
    ret = client->read(&readErrno);
    //客户端发送EOF
    if (ret <= 0 && readErrno != EAGAIN)
    {
        closeConnect(client);
        return;
    }
    onProcess(client);
}

/* 处理函数：判断读入的请求报文是否完整，决定是继续监听读还是监听写 */
//如果请求不完整，继续读，如果请求完整，则根据请求内容生成相应的响应报文，并发送
//oneshot需要再次监听
void WebServer::onProcess(HttpConnect* client)
{
    if (client->process())
    {
        epoller->modfd(client->getfd(), connEvent | EPOLLOUT);
    }
    else
    {
        epoller->modfd(client->getfd(), connEvent | EPOLLIN);
    }
}

/* 写函数：发送响应报文，大文件需要分多次发送 */
//由于设置了oneshot，需要再次监听读
void WebServer::onWrite(HttpConnect* client)
{
    assert(client);
    int ret = -1;
    int writeErrno = 0;
    ret = client->write(&writeErrno);
    //发送完毕
    if (client->toWriteBytes() == 0)
    {
        if (client->isKeepAlive())
        {
            onProcess(client);
            return;
        }
    }
    //发送失败
    else if (ret < 0)
    {
        //缓存满导致的，继续监听写
        if (writeErrno == EAGAIN)
        {
            epoller->modfd(client->getfd(), connEvent | EPOLLOUT);
            return;
        }
    }
    //其他原因导致，关闭连接
    closeConnect(client);
}

/* 创建监听套接字，并设置属性，绑定端口，向epoll注册连接事件 */
bool WebServer::initSocket()
{
    int ret;
    struct sockaddr_in addr;
    if (port > 65536 || port < 1024)
    {
        LOG_ERROR("port: %d error!", port);
        return false;
    }
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons(port);
    //设置optLinger需要的参数
    struct linger optLinger = {0};
    if (openLinger)
    {
        //优雅关闭，最多等待20s接受客户端关闭确认
        optLinger.l_onoff = 1;
        optLinger.l_linger = 20;
    }

    //创建监听套接字
    listenfd = socket(AF_INET, SOCK_STREAM, 0);
    if (listenfd < 0)
    {
        LOG_ERROR("port: %d create socket error!", port);
        return false;
    }
    //套接字设置优雅关闭
    ret = setsockopt(listenfd, SOL_SOCKET, SO_LINGER, &optLinger, sizeof(optLinger));
    if (ret == -1)
    {
        close(listenfd);
        LOG_ERROR("port: %d init linger error!", port);
        return false;
    }

    int optval = 1;
    //套接字设置端口复用（端口处于TIME_WAIT时，也可以被bind）
    ret = setsockopt(listenfd, SOL_SOCKET, SO_REUSEADDR, (const void*)&optval, sizeof(int));
    if (ret == -1)
    {
        LOG_ERROR("set socket error!");
        close(listenfd);
        return false;
    }
    //套接字绑定端口
    ret = bind(listenfd, (struct sockaddr*)&addr, sizeof(addr));
    if (ret == -1)
    {
        LOG_ERROR("bind port: %d error!", port);
        close(listenfd);
        return false;
    }
    //套接字设为可接受连接状态，并指明请求队列大小
    ret = listen(listenfd, 6);
    if (ret == -1)
    {
        LOG_ERROR("listen port: %d error!", port);
        close(listenfd);
        return false;
    }
    //向epoll注册监听套接字连接事件
    ret = epoller->addfd(listenfd, listenEvent | EPOLLIN);
    if (ret == 0)
    {
        LOG_ERROR("Add listen error!");
        close(listenfd);
        return false;
    }
    //套接字设置非阻塞（优雅关闭还是会导致close阻塞）
    setfdNonblock(listenfd);
    LOG_INFO("Server port: %d", port);
    return true;
}

/* 套接字设置非阻塞 */
int WebServer::setfdNonblock(int fd) {
    assert(fd > 0);
    return fcntl(fd, F_SETFL, fcntl(fd, F_GETFD, 0) | O_NONBLOCK);
}