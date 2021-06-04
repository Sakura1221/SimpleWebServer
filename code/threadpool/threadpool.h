#ifndef THREADPOOL_H
#define THREADPOOL_H

#include "../lock/locker.h"
#include <queue>
#include <thread>
#include <functional>
#include <memory>
#include <assert.h>

using namespace std;

class ThreadPool
{
public:
    static ThreadPool* instance()
    {
        static ThreadPool threadpool;
        return &threadpool;
    }

    /* 回调函数：从线程池的任务队列中选一个任务处理 */
    static void callback(ThreadPool* pool)
    {
        while(true)
        {
            pool->mtxPool.lock();
            while (pool->tasks.empty() && !pool->shutdown)
            {
                pool->condNotEmpty.wait(pool->mtxPool.get());
            }

            if (pool->shutdown)
            {
                pool->mtxPool.unlock();
                break;
            }
            
            //函数指针需要用move变成右值
            auto task = move(pool->tasks.front());
            pool->tasks.pop();
            pool->mtxPool.unlock();
            task(); //这里是用bind打包好的函数及其参数，可直接执行
        }
    }
    
    void init (int threadNum = 8, int maxRequests = 10000)
    {
        this->threadNum = threadNum;
        this->maxRequests = maxRequests;
        assert(threadNum > 0);
        //初始化时开辟所有线程，无任务就阻塞
        for (int i = 0; i < threadNum; i ++)
        {
            //线程分离，主线程不用负责回收子线程资源
            thread(callback, this).detach();
        }
    }

    /* 添加任务 */
    //传入方法和参数打包后的函数对象，&&表示右值引用
    template<typename F>
    void addTask(F&& task)
    {
        mtxPool.lock();
        if ((int)tasks.size() < maxRequests)
        {
            //利用forward进行完美转发，保持右值引用属性
            tasks.emplace(forward<F>(task));
            condNotEmpty.signal();
        }
        mtxPool.unlock();
    }

private:
    mtx mtxPool;
    cond condNotEmpty;
    int threadNum;
    int maxRequests;
    bool shutdown;
    //function<void>可代替函数指针，可用bind将函数指针与参数绑定
    queue<function<void()>> tasks;

    ThreadPool(){}
    ~ThreadPool()
    {
        mtxPool.lock();
        shutdown = true; //诱导子线程自己销毁
        mtxPool.unlock();
        condNotEmpty.broadcast();
    }
};

#endif