# SimpleWebServer
基于Cpp11实现的高性能Web服务器，代码简洁，注释详尽，适合新手入门
## 特性
- 利用Epoll与线程池实现Reactor高并发模型
- 利用状态机与正则实现HTTP请求报文解析，可同时处理GET与POST请求
- 用vector容器封装char，实现了一个可自动扩容的缓冲区
- 基于epoll_wait实现定时功能，关闭超时的非活动连接，并用小根堆作为容器管理定时器
- 利用单例模式实现了一个简单的线程池，减少了线程创建与销毁的开销
- 利用单例模式实现连接MySQL的数据库连接池，减少数据库连接建立与关闭的开销，实现了用户注册登录功能
- 利用单例模式与阻塞队列实现异步日志系统，记录服务器运行状态
- 能够处理前端发送的multi/form-data类型的post请求，实现了文件上传功能
- 通过jsoncpp生成json数据，向前端发送文件列表，实现了文件列表展示功能
## 环境要求
- Linux
- C++11
- MySQL 5.7.31
- jsoncpp 
## 目录树
```
.
├── bin
│   └── simpleserver 可执行文件
├── build
│   └── Makefile
├── code             源代码
│   ├── buffer       自动扩容的缓冲区
│   ├── config       配置文件
│   ├── http         HTTP请求解析、响应
│   ├── lock         锁函数封装
│   ├── log          基于阻塞队列的异步日志模块
│   ├── main.cpp     主函数
│   ├── server       基于epoll的服务器
│   ├── sqlconnpool  数据库连接池
│   ├── threadpool   线程池
│   └── timer        小根堆管理的定时器
├── log              日志目录
├── files            文件上传目录
├── Makefile
├── README.md
└── resources        静态资源
```
## 项目启动
编译安装jsoncpp库
```
cd jsoncpp
cmake CMakeLists.txt
// 会生成一个Makefile文件，make编译
make
// 执行安装（将生成的库拷贝到系统目录下）
sudo make install
```

配置数据库
```
//创建数据库
create database webdb;
//创建user表
USE yourdb;
CREATE TABLE user(
    username char(50) NULL,
    passwd char(50) NULL
)ENGINE=InnoDB;
//添加数据
INSERT INTO user(username, passwd) VALUES('your name', 'your password');

//webdb是数据库名，user是表名，需要在main函数中传入
```
然后编译运行
```
make
./bin/simpleserver
```
浏览器访问
```
127.0.0.1:9006
#9006是在main函数中传入的服务器监听端口
```
## TODO
- config配置
- webbench压力测试

## 致谢
Linux高性能服务器编程，游双著

[markparticle/WebServer](https://github.com/markparticle/WebServer)
