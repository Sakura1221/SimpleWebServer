#ifndef HEAPTIMER_H
#define HEAPTIMER_H

#include <queue>
#include <unordered_map>
#include <time.h>
#include <algorithm>
#include <arpa/inet.h>
#include <functional>
#include <assert.h>
#include <chrono>
#include "../log/log.h"

typedef std::function<void()> TimeoutCallBack;
typedef std::chrono::high_resolution_clock Clock;
typedef std::chrono::milliseconds MS;
typedef Clock::time_point TimeStamp;

//定时器结点
struct TimerNode 
{
    int id; //连接套接字描述符
    TimeStamp expires; //到期时间
    TimeoutCallBack cb; //回调函数
    //重载<，到期时间近的排在前面
    bool operator<(const TimerNode& t) 
    {
        return expires < t.expires;
    }
};

//定时器容器
class HeapTimer 
{
public:
    //reserve增加capacity，不改变size
    HeapTimer() { heap.reserve(64); }

    ~HeapTimer() { clear(); }
    
    //调整到期时间
    void adjust(int id, int newExpires);

    //增加定时器
    void add(int id, int timeOut, const TimeoutCallBack& cb);

    //回收空间
    void clear();

    //定时器计时，到期执行回调（从堆顶开始处理）
    void tick();

    //弹出最近的一个定时器
    void pop();

    //返回最近的到期时间
    int getNextTick();

private:
    void del(size_t i);
    
    void siftup(size_t i);

    void siftdown(size_t i);

    void swapNode(size_t i, size_t j);

    //数组模拟堆
    std::vector<TimerNode> heap;

    //记录每个定时器的下标
    std::unordered_map<int, size_t> ref;
};

#endif