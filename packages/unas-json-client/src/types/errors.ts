export class UnasError extends Error {
    constructor(message: string, options?: { cause?: unknown }) {
        super(message, options);
        this.name = new.target.name;
    }
}

/** Missing or invalid config (baseUrl / apiKey). */
export class UnasConfigError extends UnasError {}

/** Network / timeout failure (the HTTP call rejected). */
export class UnasTransportError extends UnasError {}

/** A non-2xx HTTP response from the UNAS API. */
export class UnasHttpError extends UnasError {
    public readonly status: number;
    public readonly url: string;
    public readonly method: string = "POST";
    public readonly responseBody?: string;
    public readonly unasErrorMessage?: string;

    constructor(
        message: string,
        status: number,
        url: string,
        options?: { responseBody?: string; unasErrorMessage?: string; cause?: unknown },
    ) {
        super(message, { cause: options?.cause });
        this.status = status;
        this.url = url;
        this.responseBody = options?.responseBody;
        this.unasErrorMessage = options?.unasErrorMessage;
    }
}

/** Login failed, or a request still failed after refreshing the token. */
export class UnasAuthError extends UnasError {}

/** The response XML was missing an expected node. */
export class UnasParseError extends UnasError {}
