// Telemetry system from Kilo Code
export class TelemetryService {
  private static _instance: TelemetryService
  
  static get instance(): TelemetryService {
    if (!TelemetryService._instance) {
      TelemetryService._instance = new TelemetryService()
    }
    return TelemetryService._instance
  }
  
  captureTaskCreated(taskId: string): void {
    this.captureEvent('task_created', { taskId })
  }
  
  captureTaskRestarted(taskId: string): void {
    this.captureEvent('task_restarted', { taskId })
  }
  
  captureLlmCompletion(taskId: string, metrics: any): void {
    this.captureEvent('llm_completion', { taskId, ...metrics })
  }
  
  captureConversationMessage(taskId: string, role: string): void {
    this.captureEvent('conversation_message', { taskId, role })
  }
  
  captureConsecutiveMistakeError(taskId: string): void {
    this.captureEvent('consecutive_mistake_error', { taskId })
  }
  
  captureEvent(eventName: string, properties: Record<string, any> = {}): void {
    // Send to analytics service
    console.log(`[Telemetry] ${eventName}:`, properties)
    
    // In production, send to analytics service:
    // await fetch('/api/telemetry', {
    //   method: 'POST',
    //   body: JSON.stringify({ event: eventName, properties })
    // })
  }
}