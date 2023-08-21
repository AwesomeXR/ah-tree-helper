export interface ITreeNode {
  id: string;
  parentId?: string;
}

export interface Dictionary<V> {
  [index: string]: V;
}

export class FlatTreeHelper<T extends ITreeNode> {
  /** 把 trace 合并成 tree */
  static reduceTraceList<_T extends ITreeNode>(traceList: _T[][]): _T[] {
    const addedIdSet = new Set<string>();
    const result: _T[] = [];

    traceList.forEach(tl => {
      tl.forEach(t => {
        if (addedIdSet.has(t.id)) return;

        result.push(t);
        addedIdSet.add(t.id);
      });
    });

    return result;
  }

  private _list: T[] = [];
  private _nodeCache = new Map<string, T>();
  private _childrenCache = new Map<string, T[]>();

  constructor(list: T[]) {
    this._list.push(...list);
    this.buildCache();
  }

  get list() {
    return this._list;
  }

  buildCache() {
    this._nodeCache.clear();
    this._childrenCache.clear();

    this._list.forEach(n => this._nodeCache.set(n.id, n));
    this._list.forEach(n => {
      this._childrenCache.set(
        n.id,
        this._list.filter(_n => (_n.parentId ? _n.parentId === n.id : false))
      );
    });
  }

  /** 深度优先遍历所有后代 */
  walk(
    startId: string,
    tap: (
      t: T,
      opt: {
        /** walk 踪迹 */
        trace: T[];
        isLeaf: boolean;
        done: () => void;
      }
    ) => void
  ) {
    if (!this._nodeCache.has(startId)) return;

    const _walk = (_id: string, _lastTrace: T[] = []) => {
      const currentTreeNode = this._nodeCache.get(_id);
      if (!currentTreeNode) return;

      let shouldStop = false;
      const done = () => {
        shouldStop = true;
      };

      const trace = [..._lastTrace, currentTreeNode];
      const childrenNodes = this._childrenCache.get(_id);
      const isLeaf = !childrenNodes || childrenNodes.length === 0;

      // tap 自己
      tap(currentTreeNode, { done, trace, isLeaf });

      // 如果用户调用了 done, 则可以停止 walk
      if (shouldStop) return;

      // 递归 tap 儿子
      !isLeaf && childrenNodes.forEach(child => _walk(child.id, trace));
    };

    _walk(startId);
  }

  /** 递归删除 */
  remove(startId: string) {
    const removeSet = new Set<string>();

    // 给后代打删除标记
    this.walk(startId, t => removeSet.add(t.id));

    // 只保留没有删除标记的节点
    this._list = this._list.filter(t => !removeSet.has(t.id));
    this.buildCache();
  }

  /** 移动 */
  move(id: string, parentId?: string, opt: { before?: string; after?: string } = {}) {
    if (opt.before && opt.after) throw new Error('before 和 after 不可同时设置');

    const targetIndex = this._list.findIndex(t => t.id === id);
    if (targetIndex < 0) throw new Error('id 不存在');

    const newTreeNode = { ...this._list[targetIndex], parentId };
    this._list[targetIndex] = newTreeNode;

    if (opt.before) {
      this._list.splice(targetIndex, 1);

      const beforeIndex = this._list.findIndex(t => t.id === opt.before);
      this._list.splice(beforeIndex, 0, newTreeNode);
    }

    if (opt.after) {
      this._list.splice(targetIndex, 1);

      const afterIndex = this._list.findIndex(t => t.id === opt.after);
      this._list.splice(afterIndex + 1, 0, newTreeNode);
    }

    this.buildCache();
  }

  /** 查找所有 parent */
  findAllParent(startId: string): T[] {
    const parentList: T[] = [];

    let current = this._nodeCache.get(startId);

    while (current) {
      parentList.unshift(current);
      current = current.parentId ? this._nodeCache.get(current.parentId) : undefined;
    }

    // 移除自己
    parentList.pop();

    return parentList;
  }

  /** 查找所有根节点 */
  findAllRoot(): T[] {
    return this._list.filter(t => !t.parentId);
  }

  /** 判断是否叶子节点 */
  isLeaf(id: string): boolean {
    const children = this._childrenCache.get(id);

    if (!children) return true;
    return children.length === 0;
  }

  /** 返回所有踪迹 */
  getAllTraceList(startId: string): T[][] {
    const re: T[][] = [];

    this.walk(startId, (_, { trace, isLeaf: _isLeaf }) => {
      // 遇到叶子节点，就可以记录下这条 trace 了
      if (_isLeaf) re.push(trace);
    });

    return re;
  }

  getById(id: string): T | undefined {
    return this._nodeCache.get(id);
  }

  getFlatChildren(id: string): T[] {
    return this._childrenCache.get(id) || [];
  }

  add(nodes: T[]) {
    if (nodes.some(n => this._nodeCache.has(n.id))) throw new Error('id has existed');
    this._list.push(...nodes);
    this.buildCache();
  }
}
