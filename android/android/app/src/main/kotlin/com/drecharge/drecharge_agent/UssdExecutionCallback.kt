package com.drecharge.drecharge_agent

interface UssdExecutionCallback {
    fun onSuccess(executedSteps: List<Map<String, Any>>)
    fun onError(code: String, message: String, executedSteps: List<Map<String, Any>>)
}
