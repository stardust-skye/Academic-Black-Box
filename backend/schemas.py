from typing import Dict, Optional, Union

from pydantic import BaseModel, Field, field_validator

from backend.ml.features import CATEGORICAL, label


class PredictRequest(BaseModel):
    student_id: Optional[str] = None
    # course / class_year are text; every other feature must be numeric.
    features: Optional[Dict[str, Union[float, str, None]]] = Field(
        default=None, description="Optional full/partial feature overrides (merged onto the student's record).")

    @field_validator("features")
    @classmethod
    def _numeric_except_categorical(cls, v):
        for k, val in (v or {}).items():
            if k not in CATEGORICAL and isinstance(val, str):
                raise ValueError(f"{label(k)} must be a number")
        return v


class SimulateRequest(BaseModel):
    student_id: str
    overrides: Dict[str, Optional[float]] = Field(default_factory=dict)


class GeminiRequest(BaseModel):
    student_id: str
    overrides: Optional[Dict[str, Optional[float]]] = None  # when present, the simulated scenario is explained


class LoginRequest(BaseModel):
    student_id: str
