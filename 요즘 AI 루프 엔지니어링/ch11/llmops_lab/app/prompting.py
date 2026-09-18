# app/prompting.py
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class SupportTicket:
    ticket_id: str
    customer_id: str
    subject: str
    message: str
    product: str
    priority: str = "normal"
    required_keywords: list[str] = field(default_factory=list)


def compile_prompt(prompt, ticket: SupportTicket) -> str:
    """Langfuse Prompt 객체와 티켓을 받아 렌더링된 문자열을 반환"""
    return prompt.compile(
        ticket_id=ticket.ticket_id,
        customer_id=ticket.customer_id,
        product=ticket.product,
        priority=ticket.priority,
        subject=ticket.subject,
        required_keywords=", ".join(ticket.required_keywords),
        message=ticket.message,
    )

PROMPT_PATH = Path(__file__).resolve().parent.parent / "prompts" / "support_answer.md"


def render_prompt(ticket: SupportTicket, template_path: Path = PROMPT_PATH) -> str:
    """로컬 템플릿 파일의 {{변수}} 를 티켓 값으로 채워 반환"""
    rendered = template_path.read_text(encoding="utf-8")
    values = {
        "ticket_id": ticket.ticket_id,
        "customer_id": ticket.customer_id,
        "product": ticket.product,
        "priority": ticket.priority,
        "subject": ticket.subject,
        "required_keywords": ", ".join(ticket.required_keywords),
        "message": ticket.message,
    }
    for key, value in values.items():
        rendered = rendered.replace("{{" + key + "}}", value)
    return rendered
