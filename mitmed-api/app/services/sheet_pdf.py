"""PDF-urile fișelor medicale (consultație, tratament, fișe construite de admin).

Generat cu fpdf2 și fontul DejaVu Sans (inclus în app/assets/fonts), singurul
mod de a avea diacriticele românești (ș, ț) corecte — fonturile standard PDF
acoperă doar Latin-1.
"""

from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from fpdf import FPDF

from app.config import settings
from app.models import ClientProfile, ConsultationSheet, ConsultationSheetField, MedicalRecord, SheetTemplate

FONTS_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
CLINIC_TIMEZONE = ZoneInfo("Europe/Bucharest")
CLINIC_NAME = "Centrul Medical MitMed"

TEAL = (14, 94, 104)
MUTED = (110, 110, 110)
RULE = (210, 215, 218)

GENDER_LABELS = {"FEMININ": "Feminin", "MASCULIN": "Masculin", "NU_DORESC_SA_SPUN": "—"}


def _local_date(value: datetime | date | None) -> str:
    if value is None:
        return "—"
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(CLINIC_TIMEZONE)
        return value.strftime("%d.%m.%Y")
    return value.strftime("%d.%m.%Y")


def _age(birth_date: date | None, at: date) -> str:
    if not birth_date:
        return "—"
    years = at.year - birth_date.year - ((at.month, at.day) < (birth_date.month, birth_date.day))
    return f"{years} ani"


class _SheetPDF(FPDF):
    def __init__(self, title: str) -> None:
        super().__init__(orientation="P", unit="mm", format="A4")
        self.add_font("DejaVu", "", str(FONTS_DIR / "DejaVuSans.ttf"))
        self.add_font("DejaVu", "B", str(FONTS_DIR / "DejaVuSans-Bold.ttf"))
        self.set_title(title)
        self.set_author(CLINIC_NAME)
        self.set_margins(18, 16, 18)
        self.set_auto_page_break(auto=True, margin=18)
        self.alias_nb_pages()

    def header(self) -> None:
        self.set_font("DejaVu", "B", 11)
        self.set_text_color(*TEAL)
        self.cell(0, 6, CLINIC_NAME, new_x="LMARGIN", new_y="NEXT")
        self.set_font("DejaVu", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 4, settings.clinic_address, new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*RULE)
        self.line(self.l_margin, self.get_y() + 2, self.w - self.r_margin, self.get_y() + 2)
        self.ln(6)
        self.set_text_color(0, 0, 0)

    def footer(self) -> None:
        self.set_y(-12)
        self.set_font("DejaVu", "", 7)
        self.set_text_color(*MUTED)
        self.cell(0, 4, f"Pagina {self.page_no()}/{{nb}}", align="R")

    # --- blocuri ---

    def title_block(self, title: str, subtitle: str) -> None:
        self.set_font("DejaVu", "B", 14)
        self.multi_cell(0, 7, title.upper(), align="C", new_x="LMARGIN", new_y="NEXT")
        if subtitle:
            self.set_font("DejaVu", "", 9)
            self.set_text_color(*MUTED)
            self.cell(0, 5, subtitle, align="C", new_x="LMARGIN", new_y="NEXT")
            self.set_text_color(0, 0, 0)
        self.ln(4)

    def section_heading(self, text: str) -> None:
        if self.get_y() > self.h - 40:
            self.add_page()
        self.ln(1)
        self.set_font("DejaVu", "B", 9)
        self.set_text_color(*TEAL)
        self.cell(0, 6, text.upper(), new_x="LMARGIN", new_y="NEXT")
        self.set_draw_color(*RULE)
        self.line(self.l_margin, self.get_y(), self.w - self.r_margin, self.get_y())
        self.ln(2)
        self.set_text_color(0, 0, 0)

    def key_values(self, pairs: list[tuple[str, str]], columns: int = 2) -> None:
        """Perechi scurte etichetă: valoare, pe coloane (date pacient, semne vitale)."""
        width = (self.w - self.l_margin - self.r_margin) / columns
        for start in range(0, len(pairs), columns):
            row = pairs[start : start + columns]
            y = self.get_y()
            heights = []
            for i, (label, value) in enumerate(row):
                self.set_xy(self.l_margin + i * width, y)
                self.set_font("DejaVu", "B", 8)
                self.set_text_color(*MUTED)
                self.cell(width, 4, label, new_x="LEFT", new_y="NEXT")
                self.set_font("DejaVu", "", 10)
                self.set_text_color(0, 0, 0)
                self.multi_cell(width - 3, 5, value or "—", new_x="LEFT", new_y="NEXT")
                heights.append(self.get_y() - y)
            self.set_xy(self.l_margin, y + max(heights) + 1.5)

    def long_field(self, label: str, value: str | None) -> None:
        if self.get_y() > self.h - 30:
            self.add_page()
        self.set_font("DejaVu", "B", 9)
        self.set_text_color(*MUTED)
        self.cell(0, 5, label, new_x="LMARGIN", new_y="NEXT")
        self.set_font("DejaVu", "", 10)
        self.set_text_color(0, 0, 0)
        self.multi_cell(0, 5, value or "—", new_x="LMARGIN", new_y="NEXT")
        self.ln(2)

    def signature_line(self, left: str) -> None:
        if self.get_y() > self.h - 35:
            self.add_page()
        self.ln(10)
        width = (self.w - self.l_margin - self.r_margin) / 2
        self.set_font("DejaVu", "", 9)
        self.set_text_color(*MUTED)
        self.cell(width, 5, left)
        self.cell(width, 5, "Semnătura și parafa medicului", align="R", new_x="LMARGIN", new_y="NEXT")
        self.ln(8)
        self.set_draw_color(*RULE)
        right = self.w - self.r_margin
        self.line(right - 60, self.get_y(), right, self.get_y())


def _patient_pairs(client: ClientProfile, at: date) -> list[tuple[str, str]]:
    data = client.profile_data or {}
    return [
        ("Nume și prenume", client.full_name),
        ("CNP", client.cnp or "—"),
        ("Vârstă", _age(client.birth_date, at)),
        ("Sex", GENDER_LABELS.get(data.get("gender") or "", "—")),
        ("Domiciliu", ", ".join(filter(None, [data.get("address"), data.get("city"), data.get("county")])) or "—"),
        ("Ocupația", data.get("occupation") or "—"),
        ("Telefon", client.phone or "—"),
    ]


def _render_fields(pdf: _SheetPDF, fields: list[ConsultationSheetField], values: dict) -> None:
    """Aceeași grupare ca formularul din portal: câmpurile consecutive dintr-o
    secțiune merg împreună, câmpurile scurte consecutive pe coloane."""
    i = 0
    while i < len(fields):
        field = fields[i]
        if field.section:
            group = []
            while i < len(fields) and fields[i].section == field.section:
                group.append(fields[i])
                i += 1
            pdf.section_heading(field.section)
            short = [f for f in group if f.field_type == "text"]
            if short:
                pdf.key_values([(f.label, values.get(f.id, "")) for f in short], columns=4 if len(short) >= 4 else 2)
            for f in group:
                if f.field_type != "text":
                    pdf.long_field(f.label, values.get(f.id))
        elif field.field_type == "text":
            group = []
            while i < len(fields) and not fields[i].section and fields[i].field_type == "text":
                group.append(fields[i])
                i += 1
            pdf.key_values([(f.label, values.get(f.id, "")) for f in group], columns=2)
        else:
            pdf.long_field(field.label, values.get(field.id))
            i += 1


def sheet_fields_for_pdf(fields: list[ConsultationSheetField], values: dict) -> list[ConsultationSheetField]:
    """Câmpurile active + cele arhivate care au totuși o valoare pe această fișă."""
    return [f for f in fields if not f.archived or values.get(f.id)]


def render_sheet_pdf(
    sheet: ConsultationSheet,
    template: SheetTemplate,
    fields: list[ConsultationSheetField],
    client: ClientProfile,
) -> bytes:
    values = sheet.field_values or {}
    sheet_day = sheet.sheet_date.astimezone(CLINIC_TIMEZONE).date() if sheet.sheet_date.tzinfo else sheet.sheet_date.date()
    pdf = _SheetPDF(template.name)
    pdf.add_page()
    subtitle = f"Data: {_local_date(sheet.sheet_date)}"
    if sheet.sheet_number:
        subtitle = f"Nr. {sheet.sheet_number} · {subtitle}"
    pdf.title_block(template.name, subtitle)
    pdf.section_heading("Date pacient")
    pdf.key_values(_patient_pairs(client, sheet_day), columns=2)
    _render_fields(pdf, sheet_fields_for_pdf(fields, values), values)
    pdf.signature_line(f"Data: {_local_date(sheet.sheet_date)}")
    return bytes(pdf.output())


def render_treatment_pdf(
    client: ClientProfile,
    records: list[MedicalRecord],
    extra_fields: list[ConsultationSheetField],
    template_name: str,
) -> bytes:
    """Fișa de tratament: toate ședințele pacientului, în ordine cronologică."""
    pdf = _SheetPDF(template_name)
    pdf.add_page()
    pdf.title_block(template_name, f"Generată la {_local_date(datetime.now(CLINIC_TIMEZONE))}")
    pdf.section_heading("Date pacient")
    pdf.key_values(_patient_pairs(client, datetime.now(CLINIC_TIMEZONE).date()), columns=2)

    if not records:
        pdf.long_field("Ședințe", "Nicio ședință înregistrată.")
    for n, record in enumerate(sorted(records, key=lambda r: r.session_date), start=1):
        therapy = record.therapy_names
        heading = f"Ședința {n} · {_local_date(record.session_date)}"
        pdf.section_heading(f"{heading} · {therapy}" if therapy else heading)
        if record.diagnosis:
            pdf.long_field("Diagnostic", record.diagnosis)
        pdf.long_field("Proceduri efectuate și răspunsul pacientului", record.notes)
        if record.subjective:
            pdf.long_field("Relatarea pacientului", record.subjective)
        if record.objective:
            pdf.long_field("Observații și măsurători", record.objective)
        if record.assessment:
            pdf.long_field("Evaluare clinică", record.assessment)
        values = record.field_values or {}
        for field in sheet_fields_for_pdf(extra_fields, values):
            if values.get(field.id):
                pdf.long_field(field.label, values[field.id])
        if record.treatment_plan:
            pdf.long_field("Plan / recomandări", record.treatment_plan)

    pdf.signature_line(f"Pacient: {client.full_name}")
    return bytes(pdf.output())
