---
name: data-structures-algorithms
description: Data structure selection, algorithm efficiency, Big-O time/space complexity optimization.
---

# Data Structures & Algorithms Skill

## Guidelines
1. **Map / Set Lookups**: Use `Set` and `Map` for O(1) membership checks and key lookups over `Array.includes()`.
2. **Sorting Efficiency**: Use native `Array.prototype.sort()` with explicit comparator functions.
3. **Avoid Nested Loops**: Replace O(n^2) nested loop array scans with single-pass hash map index lookups.
4. **Queue vs Array Shift**: Avoid `array.shift()` inside loops (O(n)); use queue data structures.
5. **Space Complexity**: Mind memory footprint when working with large dataset transformations.
