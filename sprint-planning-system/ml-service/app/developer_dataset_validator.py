"""
Developer Dataset Validator & Inspection Engine
Sprint Planning & Intelligent Resource Allocation System

Enforces Mandatory Data Policy:
1. Never limits imports to a fixed count or selects only the first few records.
2. Validates every developer record and reports invalid, duplicate, or incomplete records.
3. Preserves unique developer IDs and associates them with projects/teams.
4. Never modifies raw files in ml-service/data/.
5. Does not print sensitive personal information or passwords.
"""

import os
import sys
import json
import re
from pathlib import Path
from typing import Dict, List, Any, Tuple

# Base paths (configurable relative paths)
BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
PROCESSED_DIR = BASE_DIR / "processed-data"

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


class DeveloperDatasetValidator:
    def __init__(self):
        self.total_rows = 0
        self.valid_records: List[Dict[str, Any]] = []
        self.rejected_records: List[Dict[str, Any]] = []

    def inspect_file(self, file_path: Path) -> Dict[str, Any]:
        """
        Inspect dataset without modifying the raw file:
        - Reports row and column counts
        - Lists column names and detected types
        - Identifies missing, duplicate, and invalid fields
        """
        if not file_path.exists():
            return {"error": f"File does not exist: {file_path}"}

        ext = file_path.suffix.lower()
        rows: List[Dict[str, Any]] = []

        try:
            if ext == ".csv":
                import pandas as pd
                df = pd.read_csv(file_path)
                return self._inspect_dataframe(df, file_path.name, "CSV")
            elif ext in [".xlsx", ".xls"]:
                import pandas as pd
                df = pd.read_excel(file_path)
                return self._inspect_dataframe(df, file_path.name, "Excel")
            elif ext == ".json":
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, list):
                        rows = data
                    elif isinstance(data, dict):
                        rows = data.get("developers", [data])
                return self._inspect_records(rows, file_path.name, "JSON")
            else:
                return {"error": f"Unsupported file extension: {ext}. Supported: .csv, .xlsx, .xls, .json"}
        except Exception as e:
            return {"error": f"Failed reading file: {str(e)}"}

    def _inspect_dataframe(self, df, filename: str, file_format: str) -> Dict[str, Any]:
        column_types = {col: str(dtype) for col, dtype in df.dtypes.items()}
        missing_counts = df.isnull().sum().to_dict()
        duplicate_rows = int(df.duplicated().sum())

        records = df.to_dict(orient="records")
        validation_results = self.validate_records(records)

        return {
            "filename": filename,
            "format": file_format,
            "total_rows": len(df),
            "total_columns": len(df.columns),
            "columns": list(df.columns),
            "column_types": column_types,
            "missing_values_per_column": missing_counts,
            "duplicate_full_rows": duplicate_rows,
            "validation": validation_results
        }

    def _inspect_records(self, records: List[Dict[str, Any]], filename: str, file_format: str) -> Dict[str, Any]:
        total_rows = len(records)
        sample_cols = list(records[0].keys()) if total_rows > 0 else []
        validation_results = self.validate_records(records)

        return {
            "filename": filename,
            "format": file_format,
            "total_rows": total_rows,
            "total_columns": len(sample_cols),
            "columns": sample_cols,
            "validation": validation_results
        }

    def validate_records(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Validate every developer record against complete business rules:
        - Never limits import to a fixed number.
        - Validates name, email pattern, capacity, and experience level.
        - Audits duplicate IDs and emails.
        """
        self.total_rows = len(records)
        self.valid_records = []
        self.rejected_records = []

        seen_ids = set()
        seen_emails = set()

        for idx, raw in enumerate(records):
            row_num = idx + 1
            reasons = []

            # Extract fields with forgiving key mapping
            name = str(raw.get("name") or raw.get("fullName") or raw.get("developer_name") or "").strip()
            email = str(raw.get("email") or raw.get("developer_email") or "").strip().lower()
            raw_id = str(raw.get("id") or raw.get("developer_id") or raw.get("dev_id") or "").strip()
            role = str(raw.get("role") or "developer").strip().lower()
            title = str(raw.get("title") or raw.get("position") or "Software Developer").strip()
            exp = str(raw.get("experienceLevel") or raw.get("experience_level") or raw.get("seniority") or "Mid").strip()
            skills_raw = raw.get("skills") or raw.get("skill_tags") or []
            capacity_raw = raw.get("maxWeeklyHours") or raw.get("weekly_capacity") or raw.get("capacity") or 40
            projects_raw = raw.get("assignedProjects") or raw.get("projects") or []

            # 1. Name validation
            if not name or len(name) < 2:
                reasons.append("Name is required and must have at least 2 characters.")

            # 2. Email validation
            if not email:
                reasons.append("Email address is required.")
            elif not EMAIL_REGEX.match(email):
                reasons.append(f"Invalid email format: '{email}'.")
            elif email in seen_emails:
                reasons.append(f"Duplicate email within dataset: '{email}'.")

            # 3. ID validation
            if raw_id:
                if raw_id in seen_ids:
                    reasons.append(f"Duplicate Developer ID: '{raw_id}'.")
            else:
                raw_id = f"DEV-{row_num:04d}"

            # 4. Weekly capacity validation
            try:
                capacity = float(capacity_raw)
                if capacity <= 0 or capacity > 80:
                    reasons.append(f"Invalid weekly capacity '{capacity_raw}'. Must be between 1 and 80 hours.")
            except (ValueError, TypeError):
                reasons.append(f"Weekly capacity must be numeric, got '{capacity_raw}'.")
                capacity = 40.0

            # 5. Experience level normalization
            exp_lower = exp.lower()
            if any(k in exp_lower for k in ["sr", "senior", "lead"]):
                normalized_exp = "Senior"
            elif any(k in exp_lower for k in ["jr", "junior", "entry"]):
                normalized_exp = "Junior"
            else:
                normalized_exp = "Mid"

            # 6. Skills normalization
            skills = []
            if isinstance(skills_raw, list):
                skills = [str(s).strip() for s in skills_raw if str(s).strip()]
            elif isinstance(skills_raw, str):
                skills = [s.strip() for s in re.split(r"[,;|]", skills_raw) if s.strip()]
            skills = list(dict.fromkeys(skills))  # deduplicate preserving order

            # 7. Projects normalization
            projects = []
            if isinstance(projects_raw, list):
                projects = [str(p).strip() for p in projects_raw if str(p).strip()]
            elif isinstance(projects_raw, str):
                projects = [p.strip() for p in re.split(r"[,;|]", projects_raw) if p.strip()]

            if reasons:
                self.rejected_records.append({
                    "row_number": row_num,
                    "record_name": name or "Unknown",
                    "email": email or "N/A",
                    "rejection_reasons": reasons
                })
            else:
                seen_ids.add(raw_id)
                seen_emails.add(email)
                self.valid_records.append({
                    "id": raw_id,
                    "name": name,
                    "email": email,
                    "role": role if role in ["developer", "manager", "admin"] else "developer",
                    "title": title,
                    "experienceLevel": normalized_exp,
                    "skills": skills,
                    "maxWeeklyHours": round(capacity),
                    "assignedProjects": projects
                })

        return {
            "total_records": self.total_rows,
            "valid_count": len(self.valid_records),
            "rejected_count": len(self.rejected_records),
            "rejections": self.rejected_records
        }

    def save_processed(self, output_filename: str = "developers_validated.json") -> Path:
        """
        Saves approved validated records to ml-service/processed-data/
        Never overwrites ml-service/data/.
        """
        PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        out_path = PROCESSED_DIR / output_filename
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(self.valid_records, f, indent=2)
        return out_path


def main():
    validator = DeveloperDatasetValidator()

    target_file = None
    if len(sys.argv) > 1:
        target_file = Path(sys.argv[1])
    else:
        # Scan data directory for datasets
        candidates = list(DATA_DIR.glob("*.csv")) + list(DATA_DIR.glob("*.xlsx")) + list(DATA_DIR.glob("*.json"))
        # Exclude gitkeep
        candidates = [c for c in candidates if c.name != ".gitkeep"]
        if candidates:
            target_file = candidates[0]

    if not target_file or not target_file.exists():
        print("ℹ️ No developer dataset file found in ml-service/data/ to inspect.")
        print("Upload your dataset (.csv, .xlsx, or .json) into ml-service/data/ and re-run.")
        return

    print(f"====================================================")
    print(f"📊 INSPECTING DEVELOPER DATASET: {target_file.name}")
    print(f"====================================================")

    report = validator.inspect_file(target_file)
    if "error" in report:
        print(f"❌ Error: {report['error']}")
        return

    print(f"Format: {report['format']}")
    print(f"Total Rows: {report['total_rows']}")
    print(f"Total Columns: {report['total_columns']}")
    print(f"Columns: {', '.join(report.get('columns', []))}")

    val = report["validation"]
    print(f"\n--- Validation Summary ---")
    print(f"Total Records Processed: {val['total_records']}")
    print(f"Valid Records: {val['valid_count']}")
    print(f"Rejected Records: {val['rejected_count']}")

    if val["rejected_count"] > 0:
        print(f"\n--- Detailed Rejection Reasons (Not Discarded Silently) ---")
        for r in val["rejections"][:10]:
            print(f"  Row {r['row_number']} [{r['record_name']}]: {'; '.join(r['rejection_reasons'])}")
        if len(val["rejections"]) > 10:
            print(f"  ... and {len(val['rejections']) - 10} more rejected records.")

    print(f"\n✅ Complete dataset evaluated without arbitrary record limits.")


if __name__ == "__main__":
    main()
