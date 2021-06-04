#ifndef BUFFER_H
#define BUFFER_H

#include <cstring>
#include <iostream>
#include <unistd.h>
#include <sys/uio.h>
#include <vector>
#include <atomic>
#include <cassert>

using namespace std;

class Buffer
{
public:
    Buffer(int initBuffSize = 1024);
    ~Buffer() = default;

    size_t writableBytes() const;
    size_t readableBytes() const;
    size_t prependableBytes() const;

    const char* peek() const;
    void ensureWritable(size_t len);
    void hasWritten(size_t len);

    void retrieve(size_t len);
    void retrieveUntil(const char* end);

    void retrieveAll();
    string retrieveAllToStr();

    const char* beginWriteConst() const;
    char* beginWrite();

    void append(const string& str);
    void append(const char* str, size_t len);
    void append(const void* data, size_t len);
    void append(const Buffer& buffer);

    ssize_t readfd(int fd, int* Errno);
    ssize_t writefd(int fd, int* Errno);

private:
    char* beginPtr();
    const char* beginPtr() const;
    void makeSpace(size_t len);

    vector<char> buffer;
    atomic<size_t> readPos;
    atomic<size_t> writePos;
};

#endif