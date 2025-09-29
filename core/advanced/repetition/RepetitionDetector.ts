// Tool repetition detection from Kilo Code
export class ToolRepetitionDetector {
  private toolHistory: Array<{ toolName: string; timestamp: number; args: any }> = []
  private consecutiveLimit: number
  
  constructor(consecutiveLimit: number = 5) {
    this.consecutiveLimit = consecutiveLimit
  }
  
  detectRepetition(toolName: string, args: any): boolean {
    const now = Date.now()
    
    // Add to history
    this.toolHistory.push({ toolName, timestamp: now, args })
    
    // Clean old entries (older than 5 minutes)
    this.toolHistory = this.toolHistory.filter(
      entry => now - entry.timestamp < 5 * 60 * 1000
    )
    
    // Check for consecutive usage
    const recentSameTools = this.toolHistory
      .slice(-this.consecutiveLimit)
      .filter(entry => entry.toolName === toolName)
    
    if (recentSameTools.length >= this.consecutiveLimit) {
      // Check if arguments are similar (potential infinite loop)
      const areSimilar = this.areArgumentsSimilar(recentSameTools.map(t => t.args))
      
      if (areSimilar) {
        throw new Error(`Tool ${toolName} used ${this.consecutiveLimit} times consecutively with similar arguments - possible infinite loop detected`)
      }
      
      return true // Warning level
    }
    
    return false
  }
  
  getConsecutiveCount(toolName: string): number {
    let count = 0
    for (let i = this.toolHistory.length - 1; i >= 0; i--) {
      if (this.toolHistory[i].toolName === toolName) {
        count++
      } else {
        break
      }
    }
    return count
  }
  
  private areArgumentsSimilar(argsList: any[]): boolean {
    if (argsList.length < 2) return false
    
    const first = JSON.stringify(argsList[0])
    return argsList.every(args => JSON.stringify(args) === first)
  }
  
  reset(): void {
    this.toolHistory = []
  }
}