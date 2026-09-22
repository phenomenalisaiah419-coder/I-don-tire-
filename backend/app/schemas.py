from pydantic import BaseModel, EmailStr, Field

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)

class LoginRequest(RegisterRequest):
    pass

class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)

class EditOperation(BaseModel):
    operation: str = Field(min_length=1, max_length=80)
    asset_id: int | None = None
    start: float | None = None
    end: float | None = None
    track: str = Field(default="video", max_length=30)
    input_path: str | None = None
    params: dict = {}

    @classmethod
    def model_validate(cls, obj, *args, **kwargs):
        return super().model_validate(obj, *args, **kwargs)

class EditPlanRequest(BaseModel):
    project_id: int
    operations: list[EditOperation]
    intent: str = ""

class RenderRequest(BaseModel):
    project_id: int
    input_asset_id: int
    start: float | None = None
    end: float | None = None

class ProjectStateUpdate(BaseModel):
    state: dict
    reason: str = Field(default="manual-update", max_length=500)


class DirectorRequest(BaseModel):
    project_id: int
    instruction: str = Field(min_length=3, max_length=5000)


class TranscriptRequest(BaseModel):
    asset_id: int
    language: str | None = None

class TranscriptUpdate(BaseModel):
    text: str
    segments: list[dict] = []

class AnalysisRequest(BaseModel):
    asset_id: int
    analysis_types: list[str] = ["metadata"]
