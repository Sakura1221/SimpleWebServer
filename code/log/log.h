#ifndef LOG_H
#define LOG_H

#include <mutex>
#include <string>
#include <thread>
#include <sys/time.h>
#include <string.h>
#include <stdarg.h>           // vastart va_end
#include <assert.h>
#include <sys/stat.h>         //mkdir
#include "blockqueue.h"
#include "../buffer/buffer.h"

class Log {
public:
    //日志等级，日志路径，日志后缀，异步日志队列最大长度
    void init(int level, const char* path = "./log", 
                const char* suffix =".log",
                int maxQueueCapacity = 1024);

    static Log* instance();
    static void flushLogThread();

    void write(int level, const char *format,...);
    void flush();

    int getLevel();
    void setLevel(int level);
    bool isOpen() { return isOpen_; }
    
private:
    Log();
    void appendLogLevelTitle(int level);
    virtual ~Log();
    void asyncWrite();

private:
    static const int LOG_PATH_LEN = 256;
    static const int LOG_NAME_LEN = 256;
    static const int MAX_LINES = 50000;

    const char* path_;
    const char* suffix_;

    int MAX_LINES_;

    int lineCount;
    int today;

    bool isOpen_;
 
    Buffer buffer;
    int level_;
    bool isAsync;

    FILE* fp;
    std::unique_ptr<BlockQueue<std::string>> que; 
    std::unique_ptr<std::thread> writeThread;
    std::mutex mtx;
};

//日志等级level要给定
//可变参数宏：__VA_ARGS__
//调用日志写，并立刻将缓冲区内数据写入文件
#define LOG_BASE(level, format, ...) \
    do {\
        Log* log = Log::instance();\
        if (log->isOpen() && log->getLevel() <= level) {\
            log->write(level, format, ##__VA_ARGS__); \
            log->flush();\
        }\
    } while(0);

//分别对应不同level，调用LOG_BASE宏
//定义四个宏，方便在其他文件中使用
#define LOG_DEBUG(format, ...) do {LOG_BASE(0, format, ##__VA_ARGS__)} while(0);
#define LOG_INFO(format, ...) do {LOG_BASE(1, format, ##__VA_ARGS__)} while(0);
#define LOG_WARN(format, ...) do {LOG_BASE(2, format, ##__VA_ARGS__)} while(0);
#define LOG_ERROR(format, ...) do {LOG_BASE(3, format, ##__VA_ARGS__)} while(0);

#endif //LOG_H