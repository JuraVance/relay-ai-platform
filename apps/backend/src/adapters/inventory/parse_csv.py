#!/usr/bin/env python3
import csv
import io
import json
import sys

def parse_edealer_csv(content):
    content = content.replace('\r\n', '\n').replace('\r', '\n')
    reader = csv.DictReader(io.StringIO(content))
    rows = []
    for row in reader:
        rows.append(dict(row))
    return rows

if __name__ == '__main__':
    content = sys.stdin.read()
    rows = parse_edealer_csv(content)
    print(json.dumps(rows))