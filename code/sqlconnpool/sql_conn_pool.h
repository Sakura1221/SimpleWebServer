#ifndef SQL_CONN_POOL_H
#define SQL_CONN_POOL_H

#include <mysql/mysql.h>
#include <string>
#include <queue>
#include <thread>
#include "../lock/locker.h"
#include <mutex>
#include <semaphore.h>
#include "../log/log.h"

using namespace std;

class SqlConnPool
{
public:
    void init(const char* host, int port,
              const char* user, const char* pwd,
              const char* dbName, int maxConnCnt);
    
    void destroy();

    static SqlConnPool *instance();

    MYSQL *getConn();
    void releaseConn(MYSQL *conn);
    int getFreeConnCnt();

private:
    SqlConnPool();
    ~SqlConnPool();

    int useConnCnt;
    int freeConnCnt;

    queue<MYSQL*> connQue;
    mtx *mtxPool;
    sem *semFree;
};


class SqlConnect
{
public:
    SqlConnect(MYSQL** psql, SqlConnPool *sqlConnPool);
    ~SqlConnect();

private:
    MYSQL *sql;
    SqlConnPool *sqlConnPool;
};

#endif