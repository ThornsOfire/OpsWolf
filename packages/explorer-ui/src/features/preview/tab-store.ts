/** Pure tab collection; rendering and IO remain in their adapters. */
export class TabStore<T extends { path: string }> {
  #items: T[]=[];
  #active: string|null=null;
  #nextId=1;
  get items(): readonly T[] { return this.#items; }
  get activePath(): string|null { return this.#active; }
  activate(path: string|null): void { this.#active=path; }
  nextInstanceId(): number { return this.#nextId++; }
  append(tab: T): void { this.#items.push(tab); }
  move(path: string, targetPath: string, after: boolean): boolean {
    const from = this.#items.findIndex(tab => tab.path === path);
    if (path === targetPath || from < 0 || !this.#items.some(tab => tab.path === targetPath)) return false;
    const [tab] = this.#items.splice(from, 1);
    const target = this.#items.findIndex(item => item.path === targetPath);
    this.#items.splice(target + (after ? 1 : 0), 0, tab!);
    return true;
  }
  evictFirst(): T|undefined { return this.#items.shift(); }
  remove(index: number): T|undefined { return this.#items.splice(index,1)[0]; }
  clear(): void { this.#items.length=0; this.#active=null; }
}
