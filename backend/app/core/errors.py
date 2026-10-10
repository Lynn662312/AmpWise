from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

# HTTP status -> contract error code (docs/api_contract.md section 1)
_CODES: dict[int, str] = {400: "bad_request", 404: "not_found", 502: "llm_unavailable"}


class ApiError(Exception):
    def __init__(self, status_code: int, message: str) -> None:
        self.status_code = status_code
        self.message = message


def bad_request(message: str) -> ApiError:
    return ApiError(400, message)


def not_found(message: str) -> ApiError:
    return ApiError(404, message)


def _response(status_code: int, message: str) -> JSONResponse:
    code = _CODES.get(status_code, "internal")
    return JSONResponse(status_code=status_code, content={"error": {"code": code, "message": message}})


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(request: Request, exc: ApiError) -> JSONResponse:
        return _response(exc.status_code, exc.message)

    @app.exception_handler(RequestValidationError)
    async def _validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        first = exc.errors()[0]
        field = ".".join(str(part) for part in first["loc"][1:]) or str(first["loc"][0])
        return _response(400, f"{field}: {first['msg']}")

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        return _response(exc.status_code, str(exc.detail))

    @app.exception_handler(Exception)
    async def _unhandled(request: Request, exc: Exception) -> JSONResponse:
        return _response(500, "Internal server error")
