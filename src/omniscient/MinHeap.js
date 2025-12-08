/**
 * MinHeap - Priority queue for A* pathfinding
 */
export class MinHeap {
  constructor() {
    this.heap = [];
  }
  
  push(item) {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }
  
  pop() {
    if (this.heap.length === 0) return null;
    
    const min = this.heap[0];
    const last = this.heap.pop();
    
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    
    return min;
  }
  
  isEmpty() {
    return this.heap.length === 0;
  }
  
  bubbleUp(index) {
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.heap[parent].f <= this.heap[index].f) break;
      
      [this.heap[parent], this.heap[index]] = [this.heap[index], this.heap[parent]];
      index = parent;
    }
  }
  
  bubbleDown(index) {
    const length = this.heap.length;
    
    while (true) {
      const left = 2 * index + 1;
      const right = 2 * index + 2;
      let smallest = index;
      
      if (left < length && this.heap[left].f < this.heap[smallest].f) {
        smallest = left;
      }
      if (right < length && this.heap[right].f < this.heap[smallest].f) {
        smallest = right;
      }
      
      if (smallest === index) break;
      
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

