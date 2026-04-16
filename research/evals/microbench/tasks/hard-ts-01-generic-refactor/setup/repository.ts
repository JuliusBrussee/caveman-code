export class Repository {
  private items: any[] = [];

  constructor(private name: string) {}

  find(id: string): any | undefined {
    return this.items.find((item: any) => item.id === id);
  }

  findAll(): any[] {
    return [...this.items];
  }

  save(item: any): any {
    const index = this.items.findIndex((existing: any) => existing.id === item.id);
    if (index >= 0) {
      this.items[index] = item;
    } else {
      this.items.push(item);
    }
    return item;
  }

  delete(id: string): any | undefined {
    const index = this.items.findIndex((item: any) => item.id === id);
    if (index >= 0) {
      const removed = this.items[index];
      this.items.splice(index, 1);
      return removed;
    }
    return undefined;
  }

  list(filter?: (item: any) => boolean): any[] {
    if (filter) {
      return this.items.filter(filter);
    }
    return [...this.items];
  }

  count(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  exists(id: string): boolean {
    return this.items.some((item: any) => item.id === id);
  }
}
