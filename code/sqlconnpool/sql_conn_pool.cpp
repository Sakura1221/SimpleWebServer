#include "sql_conn_pool.h"

using namespace std;

SqlConnPool::SqlConnPool()
{
    useConnCnt = 0;
    freeConnCnt = 0;
}

void SqlConnPool::init(
    const char* host, int port, 
    const char* user, const char* pwd,
    const char* dbName, int maxConnCnt = 10)
{
    assert(maxConnCnt > 0);
    for (int i = 0; i < maxConnCnt; i ++)
    {
        MYSQL *sql = nullptr;
        sql = mysql_init(sql);
        if (!sql)
        {
            LOG_ERROR("MySQL init error!");
            assert(sql);
        }
        sql = mysql_real_connect(sql, host, user, pwd, dbName, port, nullptr, 0);
        if (!sql)
        {
            LOG_ERROR("MySQL Connect error");
        }
        connQue.push(sql);
    }
    this->freeConnCnt = maxConnCnt;

    mtxPool = new mtx();
    semFree = new sem(maxConnCnt);
}

void SqlConnPool::destroy()
{
    this->mtxPool->lock();
    while (!connQue.empty())
    {
        MYSQL* item = connQue.front();
        connQue.pop();
        mysql_close(item);
    }
    this->mtxPool->unlock();
    delete(mtxPool);
    delete(semFree);
    mysql_library_end();
}

SqlConnPool* SqlConnPool::instance()
{
    static SqlConnPool connPool;
    return &connPool;
}

MYSQL* SqlConnPool::getConn()
{
    MYSQL *sql = nullptr;

    this->semFree->wait();
    this->mtxPool->lock();
    sql = connQue.front();
    connQue.pop();
    this->useConnCnt++;
    this->freeConnCnt--;
    this->mtxPool->unlock();
    
    return sql;
}

void SqlConnPool::releaseConn(MYSQL *sql)
{
    assert(sql);
    this->mtxPool->lock();
    connQue.push(sql);
    this->useConnCnt--;
    this->freeConnCnt++;
    this->mtxPool->unlock();
    this->semFree->post();
}

int SqlConnPool::getFreeConnCnt()
{
    this->mtxPool->lock();
    return connQue.size();
    this->mtxPool->unlock();
}

SqlConnPool::~SqlConnPool()
{
    this->destroy();
}

SqlConnect::SqlConnect(MYSQL** psql, SqlConnPool *sqlConnPool)
{
    assert(sqlConnPool);
    this->sql = sqlConnPool->getConn();
    *psql = this->sql;
    this->sqlConnPool = sqlConnPool;
}

SqlConnect::~SqlConnect()
{
    if (this->sql)
    {
        this->sqlConnPool->releaseConn(this->sql);
    }
}