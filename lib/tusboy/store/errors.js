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

module.exports = StoreError;
module.exports.UploadNotFound = UploadNotFound;
module.exports.OffsetMismatch = OffsetMismatch;
module.exports.KeyNotFound = KeyNotFound;
module.exports.UploadLocked = UploadLocked;
