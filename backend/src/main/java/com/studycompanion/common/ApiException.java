package com.studycompanion.common;

public class ApiException extends RuntimeException {
    private final int status;

    public ApiException(int status, String message) {
        super(message);
        this.status = status;
    }

    public int getStatus() {
        return status;
    }

    public static ApiException notFound(String msg) {
        return new ApiException(404, msg);
    }

    public static ApiException forbidden(String msg) {
        return new ApiException(403, msg);
    }

    public static ApiException badRequest(String msg) {
        return new ApiException(400, msg);
    }

    public static ApiException conflict(String msg) {
        return new ApiException(409, msg);
    }

    public static ApiException status(int status, String msg) {
        return new ApiException(status, msg);
    }
}
