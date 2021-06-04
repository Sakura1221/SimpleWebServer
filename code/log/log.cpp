/* 同步/异步写日志
同步写日志：线程直接向文件内写入日志，写日志与线程业务是串行的
异步写日志：线程先将日志放到阻塞队列中，再用专门的线程向文件内写日志

为了避免日志混乱，需要用互斥锁实现文件的互斥访问，写日志前需要上锁
对于异步写日志：用单例模式维护一个阻塞队列，一个写线程，节约资源，减少竞态

每次调用写日志方法后，或创建新日志文件前（日期改变，行数超限），都要调用flush将缓冲区内数据全部写入文件中
如果是同步写日志，fflush(fp)即可，如果是异步，还要先保证阻塞队列被清空

*/

#include "log.h"

using namespace std;

Log::Log() {
    lineCount = 0;
    isAsync = false;
    writeThread = nullptr;
    que = nullptr;
    today = 0;
    fp = nullptr;
}

Log::~Log() {
    if(writeThread && writeThread->joinable()) {
        //循环将阻塞队列内的日志处理完毕后再关闭
        while(!que->empty())
        {
            que->flush();
        };
        que->close();
        //回收写线程资源
        writeThread->join();
    }
    //缓存写入文件后再关闭指针
    if(fp) {
        lock_guard<mutex> locker(mtx);
        flush();
        fclose(fp);
    }
}

int Log::getLevel() {
    lock_guard<mutex> locker(mtx);
    return level_;
}

void Log::setLevel(int level) {
    lock_guard<mutex> locker(mtx);
    level_ = level;
}

/* 初始化：阻塞队列，写线程，写缓冲区，日志文件指针 */
void Log::init(int level = 1, const char* path, const char* suffix,
    int maxQueueSize) {
    isOpen_ = true;
    level_ = level;
    if(maxQueueSize > 0)
    {
        isAsync = true;
        if(!que)
        {
            //初始化阻塞队列和写日志线程
            unique_ptr<BlockQueue<std::string>> newQueue(new BlockQueue<std::string>);
            que = move(newQueue);
            
            std::unique_ptr<std::thread> NewThread(new thread(flushLogThread));
            writeThread = move(NewThread);
        }
    } 
    else 
    {
        isAsync = false;
    }

    lineCount = 0;

    //初始化文件名
    time_t timer = time(nullptr);
    struct tm *sysTime = localtime(&timer);
    struct tm t = *sysTime;
    path_ = path;
    suffix_ = suffix;
    char fileName[LOG_NAME_LEN] = {0};
    snprintf(fileName, LOG_NAME_LEN - 1, "%s/%04d_%02d_%02d%s", 
            path_, t.tm_year + 1900, t.tm_mon + 1, t.tm_mday, suffix_);
    today = t.tm_mday;

    //初始化文件指针
    {
        lock_guard<mutex> locker(mtx);
        buffer.retrieveAll();
        if(fp) { 
            flush();
            fclose(fp); 
        }

        fp = fopen(fileName, "a");
        if(fp == nullptr) {
            mkdir(path_, 0777);
            fp = fopen(fileName, "a");
        } 
        assert(fp != nullptr);
    }
}

/* 写日志 */
void Log::write(int level, const char *format, ...) {
    struct timeval now = {0, 0};
    gettimeofday(&now, nullptr);
    time_t tSec = now.tv_sec;
    struct tm *sysTime = localtime(&tSec);
    struct tm t = *sysTime;
    va_list vaList;

    //日志日期改变 或 日志行数为最大行数的倍数， 创建新的log文件
    if (today != t.tm_mday || (lineCount && (lineCount % MAX_LINES) == 0))
    {
        unique_lock<mutex> locker(mtx);
        locker.unlock();
        
        char newFile[LOG_NAME_LEN];
        char tail[36] = {0};
        snprintf(tail, 36, "%04d_%02d_%02d", t.tm_year + 1900, t.tm_mon + 1, t.tm_mday);

        if (today != t.tm_mday)
        {
            snprintf(newFile, LOG_NAME_LEN - 72, "%s/%s%s", path_, tail, suffix_);
            today = t.tm_mday;
            lineCount = 0;
        }
        else {
            snprintf(newFile, LOG_NAME_LEN - 72, "%s/%s-%d%s", path_, tail, (lineCount  / MAX_LINES), suffix_);
        }
        
        locker.lock();
        flush(); //保证上一日期日志已经写完毕
        fclose(fp);
        fp = fopen(newFile, "a");
        assert(fp != nullptr);
    }

    //向文件中互斥写日志
    {
        unique_lock<mutex> locker(mtx);
        lineCount++;
        int n = snprintf(buffer.beginWrite(), 128, "%d-%02d-%02d %02d:%02d:%02d.%06ld ",
                    t.tm_year + 1900, t.tm_mon + 1, t.tm_mday,
                    t.tm_hour, t.tm_min, t.tm_sec, now.tv_usec);
                    
        buffer.hasWritten(n);
        appendLogLevelTitle(level);

        va_start(vaList, format);
        int m = vsnprintf(buffer.beginWrite(), buffer.writableBytes(), format, vaList);
        va_end(vaList);

        buffer.hasWritten(m);
        buffer.append("\n\0", 2);

        if(isAsync && que && !que->full()) {
            //先将日志写入阻塞队列，之后再异步读写
            que->push(buffer.retrieveAllToStr());
        } else {
            //直接同步写日志
            fputs(buffer.peek(), fp);
        }
        buffer.retrieveAll();
    }
}

/* 添加日志等级信息 */
void Log::appendLogLevelTitle(int level) {
    switch(level) {
    case 0:
        buffer.append("[debug]: ", 9);
        break;
    case 1:
        buffer.append("[info] : ", 9);
        break;
    case 2:
        buffer.append("[warn] : ", 9);
        break;
    case 3:
        buffer.append("[error]: ", 9);
        break;
    default:
        buffer.append("[info] : ", 9);
        break;
    }
}

/* 将缓存数据立即写入文件中 */
void Log::flush() {
    //如果是异步，唤醒写日志线程，保证阻塞队列内的日志信息完全被清空
    //写日志线程通过加锁保证在队列清空前，文件指针不会被关闭
    if(isAsync) 
    { 
        que->flush(); 
    }
    //将缓存立即写入文件中
    fflush(fp);
}

/* 异步持续写日志 */
//每个日志完成前，将阻塞队列加锁，避免读写混乱
void Log::asyncWrite() {
    string str = "";
    while(que->pop(str)) {
        lock_guard<mutex> locker(mtx);
        fputs(str.c_str(), fp);
    }
}

/* 单例模式唯一实例 */
Log* Log::instance() {
    static Log obj;
    return &obj;
}

/* 写线程回调函数，异步写日志 */
void Log::flushLogThread() {
    Log::instance()->asyncWrite();
}