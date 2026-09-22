class RecoveryResult<T> {
  final T? value;
  final String? error;
  final bool recovered;
  const RecoveryResult.success(this.value) : error = null, recovered = false;
  const RecoveryResult.failure(this.error, {this.recovered = false}) : value = null;
  bool get isSuccess => error == null;
}

class RetryPolicy {
  final int maxAttempts;
  final Duration delay;
  const RetryPolicy({this.maxAttempts = 3, this.delay = const Duration(milliseconds: 400)});

  Future<RecoveryResult<T>> run<T>(Future<T> Function() operation) async {
    Object? lastError;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return RecoveryResult.success(await operation());
      } catch (error) {
        lastError = error;
        if (attempt < maxAttempts) await Future<void>.delayed(delay * attempt);
      }
    }
    return RecoveryResult.failure('$lastError');
  }
}
