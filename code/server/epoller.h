#ifndef EPOLLER_H
#define EPOLLER_H

#include <sys/epoll.h>
#include <fcntl.h>
#include <unistd.h>
#include <assert.h>
#include <vector>
#include <errno.h>

using namespace std;

class Epoller
{
public:
    explicit Epoller(int maxEvent = 1024);
    ~Epoller();

    bool addfd(int fd, uint32_t events);
    bool modfd(int fd, uint32_t events);
    bool delfd(int fd);

    int wait(int timeoutsMs = -1);

    int getEventfd(size_t i) const;
    uint32_t getEvents(size_t i) const;
private:
    int epollfd;

    vector<struct epoll_event> events;
};

#endif