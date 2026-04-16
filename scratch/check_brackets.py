
import sys

def check_brackets(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    stack = []
    line_no = 1
    col_no = 1
    
    for i, char in enumerate(content):
        if char == '\n':
            line_no += 1
            col_no = 1
            continue
        
        if char == '{':
            stack.append(('{', line_no, col_no))
        elif char == '}':
            if not stack:
                print(f"Extra '}}' found at line {line_no}, col {col_no}")
                # Print context
                start = max(0, i - 20)
                end = min(len(content), i + 20)
                print(f"Context: ...{content[start:end]}...")
                return
            stack.pop()
        
        col_no += 1
    
    if stack:
        for char, l, c in stack:
            print(f"Unclosed '{char}' at line {l}, col {c}")
    else:
        print("Brackets are balanced")

if __name__ == "__main__":
    check_brackets(sys.argv[1])
