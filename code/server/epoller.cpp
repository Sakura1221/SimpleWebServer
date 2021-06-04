#include "epoller.h"

Epoller::Epoller(int maxEvent):epollfd(epoll_create(512)), events(maxEvent)
{
    assert(epollfd >= 0 && events.size() > 0);
}

Epoller::~Epoller()
{
    close(epollfd);
}

bool Epoller::addfd(int fd, uint32_t events)
{
    if (fd < 0) return false;
    epoll_event ev = {0};
    ev.data.fd = fd;
    ev.events = events;
    return epoll_ctl(epollfd, EPOLL_CTL_ADD, fd, &ev) == 0;
}

bool Epoller::modfd(int fd, uint32_t events)
{
    if (fd < 0) return false;
    epoll_event ev = {0};
    ev.data.fd = fd;
    ev.events = events;
    return epoll_ctl(epollfd, EPOLL_CTL_MOD, fd, &ev) == 0;
}

bool Epoller::delfd(int fd)
{
    if (fd < 0) return false;
    epoll_event ev = {0};
    ev.data.fd = fd;
    return epoll_ctl(epollfd, EPOLL_CTL_DEL, fd, &ev) == 0;
}

int Epoller::wait(int timeoutMs)
{
    return epoll_wait(epollfd, &events[0], (int)events.size(), timeoutMs);
}

int Epoller::getEventfd(size_t i) const
{
    assert(i < events.size() && i >= 0);
    return events[i].data.fd;
}

uint32_t Epoller::getEvents(size_t i) const
{
    assert(i < events.size() && i >= 0);
    return events[i].events;
}