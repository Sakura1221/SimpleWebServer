#ifndef HTTPCONNECT_H
#define HTTPCONNECT_H

#include <sys/types.h>
#include <sys/uio.h>
#include <arpa/inet.h>
#include <stdlib.h>
#include <errno.h>

#include "../log/log.h"
#include "../sqlconnpool/sql_conn_pool.h"
#include "../buffer/buffer.h"
#include "httprequest.h"
#include "httpresponse.h"

using namespace std;

class HttpConnect
{
public:
    HttpConnect();
    ~HttpConnect() {closeConnect();}

    void init(int sockfd, const sockaddr_in& addr);

    ssize_t read(int* saveErrno);
    ssize_t write(int* saveErrno);

    void closeConnect();

    int getfd() const {return fd;}
    sockaddr_in getAddr() const {return addr;}
    int getPort() const {return addr.sin_port;}
    const char* getIP() const {return inet_ntoa(addr.sin_addr);}

    bool process();

    int toWriteBytes()
    {
        return iov[0].iov_len + iov[1].iov_len;
    }

    bool isKeepAlive() const
    {
        return request.isKeepAlive();
    }

    static bool isET;
    static const char* srcDir;
    static atomic<int> userCnt;

private:
    int fd;
    struct sockaddr_in addr;

    bool isClose;

    int iovCnt;
    struct iovec iov[2];

    Buffer readBuffer;
    Buffer writeBuffer;

    HttpRequest request;
    HttpResponse response;
};

#endif