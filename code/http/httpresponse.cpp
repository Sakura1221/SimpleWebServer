#include "httpresponse.h"

using namespace std;

const unordered_map<string, string> HttpResponse::SUFFIX_TYPE = 
{
    { ".html",  "text/html" },
    { ".xml",   "text/xml" },
    { ".xhtml", "application/xhtml+xml" },
    { ".txt",   "text/plain" },
    { ".rtf",   "application/rtf" },
    { ".pdf",   "application/pdf" },
    { ".word",  "application/msword" },
    { ".png",   "image/png" },
    { ".gif",   "image/gif" },
    { ".jpg",   "image/jpeg" },
    { ".jpeg",  "image/jpeg" },
    { ".au",    "audio/basic" },
    { ".mpeg",  "video/mpeg" },
    { ".mpg",   "video/mpeg" },
    { ".avi",   "video/x-msvideo" },
    { ".gz",    "application/x-gzip" },
    { ".tar",   "application/x-tar" },
    { ".css",   "text/css "},
    { ".js",    "text/javascript "},
};

const unordered_map<int, string> HttpResponse::CODE_STATUS = 
{
    { 200, "OK" },
    { 400, "Bad Request" },
    { 403, "Forbidden" },
    { 404, "Not Found" },
};

const unordered_map<int, string> HttpResponse::CODE_PATH = 
{
    { 400, "/400.html" },
    { 403, "/403.html" },
    { 404, "/404.html" },
};

HttpResponse::HttpResponse()
{
    code = -1;
    path = srcDir = "";
    isKeepAlive = false;
    mmFile = nullptr;
    mmFileStat = {0};
}

HttpResponse::~HttpResponse()
{
    unmapFile();
}

/* 响应报文初始化： 状态码，长连接，文件路径 */
void HttpResponse::init(const string& srcDir, string& path, bool isKeepAlive, int code)
{
    assert(srcDir != "");
    if (mmFile) unmapFile();
    this->code = code;
    this->isKeepAlive = isKeepAlive;
    this->path = path;
    this->srcDir = srcDir;
    mmFile = nullptr;
    mmFileStat = {0};
}

/* 制作响应报文 */
void HttpResponse::makeResponse(Buffer& buffer)
{
    if (stat((srcDir + path).data(), &mmFileStat) < 0 || S_ISDIR(mmFileStat.st_mode))
    {
        code = 404;
    } 
    else if (!(mmFileStat.st_mode & S_IROTH))
    {
        code = 403;
    }
    else if (code == -1)
    {
        code = 200;
    }
    //如果代码存在，跳转到相应页面，否则跳转到错误页面
    errorHtml();
    //添加状态行
    addState(buffer);
    //添加响应头
    addHeader(buffer);
    //添加响应体
    addContent(buffer);
}

/* 获取映射好的文件 */
char* HttpResponse::getFile()
{
    return mmFile;
}

size_t HttpResponse::getFileLen() const
{
    return mmFileStat.st_size;
}

/* 范围外错误页面 */
void HttpResponse::errorContent(Buffer& buffer, string message)
{
    string body;
    string status;
    body += "<html><title>Error</title>";
    body += "<body bgcolor=\"ffffff\">";
    if (CODE_STATUS.count(code))
    {
        status = CODE_STATUS.find(code)->second;
    }
    else
    {
        status = "Bad Request";
    }
    body += to_string(code) + " : " + status + "\n";
    body += "<p>" + message + "</p>";
    body += "<hr><em>SimpleWebServer</em></body></html>";

    buffer.append("Content-length: " + to_string(body.size()) + "\r\n\r\n");
    buffer.append(body);
}

int HttpResponse::getCode() const
{
    return code;
}

/* 解除文件映射 */
void HttpResponse::unmapFile()
{
    if (mmFile)
    {
        munmap(mmFile, mmFileStat.st_size);
        mmFile = nullptr;
    }
}

/* 添加状态行 */
void HttpResponse::addState(Buffer& buffer)
{
    string status;
    if (CODE_STATUS.count(code))
    {
        status = CODE_STATUS.find(code)->second;
    }
    else
    {
        code = 400;
        status = CODE_STATUS.find(400)->second;
    }
    buffer.append("HTTP/1.1 " + to_string(code) + " " + status + "\r\n");
}

/* 添加响应头 */
void HttpResponse::addHeader(Buffer& buffer)
{
    buffer.append("Connection: ");
    if (isKeepAlive)
    {
        buffer.append("keep-alive\r\n");
        buffer.append("keep-alive: max=6, timeout=120\r\n");
    }
    else
    {
        buffer.append("close\r\n");
    }
    buffer.append("Content-type: " + getFileType() + "\r\n");
}

/* 添加响应体 */
void HttpResponse::addContent(Buffer& buffer)
{
    int srcfd = open((srcDir + path).data(), O_RDONLY);
    if (srcfd < 0)
    {
        errorContent(buffer, "File Not Found!");
        return;
    }
    LOG_DEBUG("file path %s", (srcDir + path).data());

    //将文件映射到内存提高文件的访问速度
    //PROT_READ：映射区可读
    //MAP_PRIVATE：写入时复制
    int* mmRet = (int*)mmap(0, mmFileStat.st_size, PROT_READ, MAP_PRIVATE, srcfd, 0);
    if (*mmRet == -1)
    {
        errorContent(buffer, "File Not Found!");
        return;
    }
    mmFile = (char*)mmRet;
    close(srcfd);
    buffer.append("Content-length: " + to_string(mmFileStat.st_size) + "\r\n\r\n");
}

/* 范围内的错误页面 */
void HttpResponse::errorHtml()
{
    if (CODE_PATH.count(code))
    {
        path = CODE_PATH.find(code)->second;
        stat((srcDir + path).data(), &mmFileStat);
    }
}

/* 判断文件类型 */
string HttpResponse::getFileType()
{
    string::size_type idx = path.find_last_of('.');
    if (idx == string::npos) return "text/plain";
    string suffix = path.substr(idx);
    if (SUFFIX_TYPE.count(suffix))
    {
        return SUFFIX_TYPE.find(suffix)->second;
    }
    return "text/plain";
}