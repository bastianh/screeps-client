export interface Subscription {
  dispose(): void
}

export class SubscriptionGroup implements Subscription {
  private readonly subs: Subscription[] = []

  add(sub: Subscription): void {
    this.subs.push(sub)
  }

  dispose(): void {
    for (const sub of this.subs) {
      sub.dispose()
    }
    this.subs.length = 0
  }
}
