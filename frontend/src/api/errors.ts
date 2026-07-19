export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldRef?: string;

  constructor(params: { code: string; status: number; message: string; fieldRef?: string }) {
    super(params.message);
    this.name = "ApiError";
    this.code = params.code;
    this.status = params.status;
    this.fieldRef = params.fieldRef;
  }
}
