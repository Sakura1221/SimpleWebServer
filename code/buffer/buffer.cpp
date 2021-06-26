#include "buffer.h"

using namespace std;

/*
内存模型：
begin---------read--------write--------end
begin-read: prependable
read-write: readable
begin-end: writalbe
*/

Buffer::Buffer(int initBuffSize) : buffer(initBuffSize), readPos(0), writePos(0) {}

size_t Buffer::readableBytes() const
{
    return writePos - readPos;
}

size_t Buffer::writableBytes() const
{
    return buffer.size() - writePos;
}

size_t Buffer::prependableBytes() const
{
    return readPos;
}

//读起点
const char* Buffer::peek() const
{
    return beginPtr() + readPos;
}

//回收内存
void Buffer::retrieve(size_t len)
{
    assert(len <= readableBytes());
    readPos += len;
}

void Buffer::retrieveUntil(const char* end)
{
    assert(peek() <= end);
    retrieve(end - peek());
}

void Buffer::retrieveAll()
{
    bzero(&buffer[0], buffer.size());
    readPos = 0;
    writePos = 0;
}

string Buffer::retrieveAllToStr()
{
    string str(peek(), readableBytes());
    retrieveAll();
    return str;
}

const char* Buffer::beginWriteConst() const
{
    return beginPtr() + writePos;
}

char* Buffer::beginWrite()
{
    return beginPtr() + writePos;
}

void Buffer::hasWritten(size_t len)
{
    writePos += len;
}

void Buffer::append(const string& str)
{
    append(str.data(), str.length());
}

void Buffer::append(const void* data, size_t len)
{
    assert(data);
    append(static_cast<const char*>(data), len);
}

void Buffer::append(const char* str, size_t len)
{
    assert(str);
    ensureWritable(len);
    copy(str, str + len, beginWrite());
    hasWritten(len);
}

void Buffer::append(const Buffer& buffer)
{
    append(buffer.peek(), buffer.readableBytes());
}

void Buffer::ensureWritable(size_t len)
{
    if (writableBytes() < len)
    {
        makeSpace(len);
    }
    assert(writableBytes() >= len);
}

ssize_t Buffer::readfd(int fd, int* saveErrno)
{
    char newbuffer[65536];
    struct iovec iov[2];
    const size_t writable = writableBytes();

    iov[0].iov_base = beginPtr() + writePos;
    iov[0].iov_len = writable;
    iov[1].iov_base = newbuffer;
    iov[1].iov_len = sizeof(newbuffer);

    const ssize_t len = readv(fd, iov, 2);
    if (len < 0)
    {
        *saveErrno = errno;
    }
    else if (static_cast<size_t>(len) <= writable)
    {
        writePos += len;
    }
    //buffer is full, append newbuffer
    else
    {
        writePos = buffer.size();
        append(newbuffer, len - writable);
    }
    return len;
}

ssize_t Buffer::writefd(int fd, int* saveErrno)
{
    size_t readSize = readableBytes();
    ssize_t len = write(fd, peek(), readSize);
    if (len < 0)
    {
        *saveErrno = errno;
        return len;
    }
    readPos += len;
    return len;
}

char* Buffer::beginPtr()
{
    return &*buffer.begin();
}

const char* Buffer::beginPtr() const
{
    return &*buffer.begin();
}

void Buffer::makeSpace(size_t len)
{
    //buffer is full
    if (writableBytes() + prependableBytes() < len)
    {
        buffer.resize(writePos + len + 1);
    }
    //the front is not full
    else
    {
        size_t readable = readableBytes();
        //transfer data to prependable
        copy(beginPtr() + readPos, beginPtr() + writePos, beginPtr());
        readPos = 0;
        writePos = readPos + readable;
        assert(readable == readableBytes());
    }
}
