class StoreError extends Error {
}

class UploadNotFound extends StoreError {
}

class OffsetMismatch extends StoreError {
}

class KeyNotFound extends StoreError {
}

class UploadLocked extends StoreError {
}

class UploadLengthExceeded extends StoreError {
}

class RequestAborted extends StoreError {
}

module.exports = StoreError;
module.exports.UploadNotFound = UploadNotFound;
module.exports.OffsetMismatch = OffsetMismatch;
module.exports.KeyNotFound = KeyNotFound;
module.exports.UploadLocked = UploadLocked;
module.exports.UploadLengthExceeded = UploadLengthExceeded;
module.exports.RequestAborted = RequestAborted;
