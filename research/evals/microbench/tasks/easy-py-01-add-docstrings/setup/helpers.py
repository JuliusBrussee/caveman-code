import re
from datetime import datetime


def parse_csv(raw_text, delimiter=","):
    lines = raw_text.strip().split("\n")
    header = lines[0].split(delimiter)
    rows = []
    for line in lines[1:]:
        values = line.split(delimiter)
        rows.append(dict(zip(header, values)))
    return rows


def format_date(dt, fmt="%Y-%m-%d"):
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    return dt.strftime(fmt)


def slugify(text):
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    return text
