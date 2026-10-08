// covers: a raw string
#include <iostream>
#include <regex>
#include <string>

static const char* kUsage = R"(usage: duck [options] <file>
  -o <path>   write output to <path> (default: "out.txt")
  -v          verbose; prints each step
  -h          show this help
)";

static const std::string kJson = R"json({
  "name": "duck",
  "tags": ["yellow", "rubber"],
  "note": "contains )\" and ; on purpose"
})json";

bool looksLikeDate(const std::string& s) {
    static const std::regex re(R"(\d{4}-\d{2}-\d{2})");
    return std::regex_match(s, re);
}

int main(int argc, char** argv) {
    if (argc < 2) {
        std::cerr << kUsage;
        return 1;
    }
    std::cout << kJson << "\n";
    std::cout << std::boolalpha << looksLikeDate(argv[1]) << "\n";
    return 0;
}
