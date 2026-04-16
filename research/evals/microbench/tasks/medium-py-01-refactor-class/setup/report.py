from datetime import datetime


class ReportGenerator:
    def __init__(self, title: str, author: str, department: str):
        self.title = title
        self.author = author
        self.department = department
        self.sections: list[dict] = []

    def add_section(self, heading: str, content: str) -> None:
        self.sections.append({"heading": heading, "content": content})

    def generate(self) -> str:
        lines: list[str] = []

        # --- Header formatting block (extract this) ---
        border = "=" * 60
        lines.append(border)
        lines.append(f"  REPORT: {self.title.upper()}")
        lines.append(f"  Author: {self.author}")
        lines.append(f"  Department: {self.department}")
        lines.append(f"  Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        lines.append(border)
        lines.append("")
        # --- End header block ---

        for i, section in enumerate(self.sections, start=1):
            lines.append(f"{i}. {section['heading']}")
            lines.append("-" * 40)
            lines.append(section["content"])
            lines.append("")

        lines.append(border)
        lines.append("  END OF REPORT")
        lines.append(border)

        return "\n".join(lines)
