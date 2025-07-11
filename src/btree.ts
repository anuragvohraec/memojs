// btree.ts: Full B+ Tree with LL and BB namespaces, ported from C++ to TypeScript

// --- Core Types ---

export type ComparatorFunction<K> = (k1: K, k2: K) => number;

export enum SearchType {
    LesserThanOrEqualsTo,
    EqualsTo,
    GreaterThanOrEqualsTo,
    LesserThan,
    GreaterThan,
}

export class LinkedNode<K> {
    rightSibling?: LinkedNode<K>;
    leftSibling?: LinkedNode<K>;
    duplicate_count = 0;
    key: K;

    constructor(key: K) {
        this.key = key;
    }
}

export class SortedLinkedList<K> {
    min?: LinkedNode<K>;
    max?: LinkedNode<K>;
    count = 0;
}

export class BPlusCell<K> {
    key: K;
    value?: any;
    right_child_node?: BPlusNode<K>;
    parentNodeForRightChildNode?: BPlusNode<K>;

    constructor(key: K, right_child_node?: BPlusNode<K>, parentNodeForRightChildNode?: BPlusNode<K>) {
        this.key = key;
        this.right_child_node = right_child_node;
        this.parentNodeForRightChildNode = parentNodeForRightChildNode;
    }
}

export class BPlusNode<K> {
    parent_cell?: BPlusCell<K>;
    rightSibling?: BPlusNode<K>;
    leftSibling?: BPlusNode<K>;
    parent_node?: BPlusNode<K>;
    cellsList: SortedLinkedList<BPlusCell<K>> = new SortedLinkedList<BPlusCell<K>>();
    parent_tree?: BPlusTree<K>;
    left_most_child?: BPlusNode<K>;
    isLeaf = false;

    isLeftMostNode(): boolean {
        return this.parent_cell == null;
    }

    isRoot(): boolean {
        return this.parent_node == null;
    }

    size(): number {
        return this.cellsList.count;
    }
}

export class BPlusTree<K> {
    left_most_node?: BPlusNode<K>;
    right_most_node?: BPlusNode<K>;
    root_node?: BPlusNode<K>;

    size = 0;
    half_capacity = 0;
    max_node_size: number;

    constructor(max_node_size: number) {
        if (max_node_size % 2 === 1) {
            throw new Error("node_size for tree must be an even number");
        }
        this.max_node_size = max_node_size;
        this.half_capacity = Math.floor(this.max_node_size / 2);
    }
}

// --- Node/Cell Creation Utilities ---

export function createBPlusNode<K>(
    parent_tree: BPlusTree<K>,
    isLeaf: boolean,
    parent_node?: BPlusNode<K>,
    left_most_child?: BPlusNode<K>
): BPlusNode<K> {
    const node = new BPlusNode<K>();
    node.parent_tree = parent_tree;
    node.isLeaf = isLeaf;
    node.parent_node = parent_node;
    node.left_most_child = left_most_child;
    node.cellsList = new SortedLinkedList<BPlusCell<K>>();
    if (node.left_most_child) {
        node.left_most_child.parent_node = node;
        node.left_most_child.parent_cell = undefined;
    }
    return node;
}

export function createBPlusCell<K>(
    key: K,
    right_child_node?: BPlusNode<K>,
    parentNodeForRightChildNode?: BPlusNode<K>
): BPlusCell<K> {
    const cell = new BPlusCell<K>(key, right_child_node, parentNodeForRightChildNode);
    if (cell.right_child_node) {
        cell.right_child_node.parent_cell = cell;
        if (cell.right_child_node.parent_node)
            cell.right_child_node.parent_node = parentNodeForRightChildNode;
    }
    return cell;
}

export function setAsCellsList<K>(node: BPlusNode<K>, newCellsList: SortedLinkedList<BPlusCell<K>>): void {
    if (!node.isLeaf) {
        let currentLinkedNode = newCellsList.min;
        while (currentLinkedNode) {
            if (currentLinkedNode.key.right_child_node)
                currentLinkedNode.key.right_child_node.parent_node = node;
            currentLinkedNode = currentLinkedNode.rightSibling;
        }
    }
    node.cellsList = newCellsList;
}

export function reinforceParentShipInChildNodes<K>(node: BPlusNode<K>): void {
    if (!node.isLeaf && node.cellsList) {
        let currentLinkedNode = node.cellsList.min;
        while (currentLinkedNode) {
            if (currentLinkedNode.key.right_child_node)
                currentLinkedNode.key.right_child_node.parent_node = node;
            currentLinkedNode = currentLinkedNode.rightSibling;
        }
    }
}

export function setAsLeftMostChildNode<K>(node: BPlusNode<K>, nodeToSetAsLeftMostChild: BPlusNode<K>): void {
    node.left_most_child = nodeToSetAsLeftMostChild;
    nodeToSetAsLeftMostChild.parent_node = node;
    nodeToSetAsLeftMostChild.parent_cell = undefined;
}

// --- LL Namespace (SortedLinkedList Engine) ---

export namespace LL {
    export function search<K>(
        list: SortedLinkedList<K>,
        compare: ComparatorFunction<K>,
        searchKey: K,
        searchType: SearchType = SearchType.EqualsTo
    ): LinkedNode<K> | undefined {
        if (!list.min) return undefined;

        let eq: LinkedNode<K> | undefined;
        let lte: LinkedNode<K> | undefined;
        let gte: LinkedNode<K> | undefined;

        let current_node = list.min;
        while (current_node) {
            const compareResult = compare(searchKey, current_node.key);
            if (compareResult === 0) {
                if (searchType === SearchType.GreaterThan) {
                    current_node = current_node.rightSibling!;
                } else {
                    eq = current_node;
                    break;
                }
            } else if (compareResult > 0) {
                lte = current_node;
                current_node = current_node.rightSibling!;
            } else {
                gte = current_node;
                break;
            }
        }

        switch (searchType) {
            case SearchType.LesserThanOrEqualsTo: return eq || lte;
            case SearchType.EqualsTo: return eq;
            case SearchType.GreaterThanOrEqualsTo: return eq || gte;
            case SearchType.LesserThan: return lte;
            case SearchType.GreaterThan: return gte;
        }
        return undefined;
    }

    export function insert<K>(
        list: SortedLinkedList<K>,
        compare: ComparatorFunction<K>,
        key: K
    ): LinkedNode<K> {
        const newNode = new LinkedNode<K>(key);
        if (!list.min) {
            list.min = newNode;
            list.max = newNode;
        } else {
            const foundNode = search(list, compare, key, SearchType.LesserThanOrEqualsTo);
            if (!foundNode) {
                list.min.leftSibling = newNode;
                newNode.rightSibling = list.min;
                list.min = newNode;
            } else {
                if (compare(key, foundNode.key) === 0) {
                    foundNode.duplicate_count++;
                    list.count--;
                    foundNode.key = newNode.key;
                    return foundNode;
                } else {
                    const right_sibling = foundNode.rightSibling;
                    foundNode.rightSibling = newNode;
                    newNode.leftSibling = foundNode;
                    newNode.rightSibling = right_sibling;
                    if (right_sibling) right_sibling.leftSibling = newNode;
                    if (foundNode === list.max) list.max = newNode;
                }
            }
        }
        list.count++;
        return newNode;
    }

    export function deleteNode<K>(
        list: SortedLinkedList<K>,
        compare: ComparatorFunction<K>,
        key: K
    ): LinkedNode<K> | undefined {
        const nodeToDelete = search(list, compare, key, SearchType.EqualsTo);
        if (nodeToDelete) {
            const deletedNode = new LinkedNode<K>(nodeToDelete.key);
            deletedNode.duplicate_count = nodeToDelete.duplicate_count;
            if (list.count === 1) {
                list.min = undefined;
                list.max = undefined;
            } else {
                if (nodeToDelete === list.min) {
                    const oldMin = list.min;
                    list.min = nodeToDelete.rightSibling;
                    if (oldMin.rightSibling) oldMin.rightSibling.leftSibling = undefined;
                    oldMin.rightSibling = undefined;
                } else if (nodeToDelete === list.max) {
                    const oldMax = list.max;
                    list.max = nodeToDelete.leftSibling;
                    if (oldMax.leftSibling) oldMax.leftSibling.rightSibling = undefined;
                    oldMax.leftSibling = undefined;
                }
                const left_sibling = nodeToDelete.leftSibling;
                const right_sibling = nodeToDelete.rightSibling;
                if (left_sibling) left_sibling.rightSibling = right_sibling;
                if (right_sibling) right_sibling.leftSibling = left_sibling;
                nodeToDelete.leftSibling = undefined;
                nodeToDelete.rightSibling = undefined;
            }
            list.count -= (deletedNode.duplicate_count + 1);
            return deletedNode;
        }
        return undefined;
    }

    export function splitAt<K>(
        listToSplit: SortedLinkedList<K>,
        splitAfterIndex: number
    ): [SortedLinkedList<K>, SortedLinkedList<K>] {
        if (listToSplit.count < 2)
            throw new Error("Size of List to be split must be at least 2");
        if (!(splitAfterIndex < listToSplit.count - 1)) {
            if (splitAfterIndex === listToSplit.count - 1) {
                return [listToSplit, new SortedLinkedList<K>()];
            }
            throw new Error("splitAtIndex must be less than listToSplit.count-1");
        }
        const origSize = listToSplit.count;
        let minOfRightPortion = listToSplit.min;
        for (let i = 0; i <= splitAfterIndex; i++) {
            if (minOfRightPortion) minOfRightPortion = minOfRightPortion.rightSibling;
        }
        let maxOfLeftPortion: LinkedNode<K> | undefined;
        if (minOfRightPortion) {
            maxOfLeftPortion = minOfRightPortion.leftSibling;
        }
        if (maxOfLeftPortion)
            maxOfLeftPortion.rightSibling = undefined;
        if (minOfRightPortion)
            minOfRightPortion.leftSibling = undefined;

        // Left part
        listToSplit.count = splitAfterIndex + 1;
        listToSplit.max = maxOfLeftPortion;

        // Right part
        const rightPortion = new SortedLinkedList<K>();
        rightPortion.min = minOfRightPortion;
        rightPortion.max = listToSplit.max;
        rightPortion.count = origSize - splitAfterIndex - 1;

        return [listToSplit, rightPortion];
    }

    export function mergeSplittedRightIntoLeft<K>(
        leftlist: SortedLinkedList<K>,
        rightlist: SortedLinkedList<K>
    ): SortedLinkedList<K> {
        if (rightlist.count === 0) return leftlist;
        if (leftlist.max) leftlist.max.rightSibling = rightlist.min;
        if (rightlist.min) rightlist.min.leftSibling = leftlist.max;
        leftlist.max = rightlist.max;
        leftlist.count += rightlist.count;
        return leftlist;
    }

    export function mergeSplittedLeftIntoRight<K>(
        leftlist: SortedLinkedList<K>,
        rightlist: SortedLinkedList<K>
    ): SortedLinkedList<K> {
        if (leftlist.count === 0) return rightlist;
        if (leftlist.max) leftlist.max.rightSibling = rightlist.min;
        if (rightlist.min) rightlist.min.leftSibling = leftlist.max;
        rightlist.min = leftlist.min;
        rightlist.count += leftlist.count;
        return rightlist;
    }

    export function searchTillStream<K>(
        list: SortedLinkedList<K>,
        compare: ComparatorFunction<K>,
        startKey?: K,
        endKey?: K,
        yieldIndividualDuplicates: boolean = false
    ): K[] {
        const result: K[] = [];
        let currentNode: LinkedNode<K> | undefined = !startKey
            ? list.min
            : LL.search(list, compare, startKey, SearchType.GreaterThanOrEqualsTo);
        const endNode: LinkedNode<K> | undefined = !endKey
            ? list.max
            : LL.search(list, compare, endKey, SearchType.LesserThanOrEqualsTo);

        if (endNode) {
            while (currentNode) {
                const cr = compare(endNode.key, currentNode.key);
                if (cr >= 0) {
                    const res = currentNode;
                    currentNode = currentNode.rightSibling;
                    if (yieldIndividualDuplicates) {
                        const countOfDuplicates = (res.duplicate_count || 0) + 1;
                        for (let i = 0; i < countOfDuplicates; i++) {
                            result.push(res.key);
                        }
                    } else {
                        result.push(res.key);
                    }
                } else {
                    currentNode = undefined;
                }
            }
        }
        return result;
    }

    export function find<K>(
        list: SortedLinkedList<K>,
        queryCompare: ComparatorFunction<K>,
        yieldIndividualDuplicates: boolean = false
    ): K[] {
        const result: K[] = [];
        let cn = list.min;
        while (cn) {
            if (queryCompare(cn.key, cn.key) === 0) {
                result.push(cn.key);
            }
            cn = cn.rightSibling;
        }
        return result;
    }
}



// Key Value pair for findKV and rangeKVP
export class BB_KV_P<K, V> {
    key: K;
    value: V;
    constructor(key: K, value: V) {
        this.key = key;
        this.value = value;
    }
}

export enum BalanceCase {
    DO_NOTHING,
    REMOVE_ROOT,
    SPLIT,
    DISTRIBUTE_RIGHT_INTO_NODE,
    DISTRIBUTE_LEFT_INTO_NODE,
    MERGE_RIGHT_INTO_NODE,
    MERGE_NODE_INTO_LEFT,
}
export enum SOURCE_IS {
    LEFT_SIBLING, RIGHT_SIBLING
}

export namespace BB {
    function _determineBalancingCase<K>(tree: BPlusTree<K>, effectedNode: BPlusNode<K>): BalanceCase {
        const node_size = effectedNode.size();
        const half_capacity = tree.half_capacity;

        if (half_capacity <= node_size && node_size <= tree.max_node_size) {
            return BalanceCase.DO_NOTHING;
        } else {
            if (node_size > tree.max_node_size) {
                return BalanceCase.SPLIT;
            } else {
                let left_sibling_size = 0;
                if (effectedNode.leftSibling) left_sibling_size = effectedNode.leftSibling.size();
                let right_sibling_size = 0;
                if (effectedNode.rightSibling) right_sibling_size = effectedNode.rightSibling.size();

                // root case
                if (left_sibling_size === 0 && right_sibling_size === 0) {
                    if (effectedNode.size() === 0) return BalanceCase.REMOVE_ROOT;
                    else return BalanceCase.DO_NOTHING;
                }
                if (right_sibling_size > half_capacity) return BalanceCase.DISTRIBUTE_RIGHT_INTO_NODE;
                if (left_sibling_size > half_capacity) return BalanceCase.DISTRIBUTE_LEFT_INTO_NODE;
                if (right_sibling_size > 0) return BalanceCase.MERGE_RIGHT_INTO_NODE;
                if (left_sibling_size > 0) return BalanceCase.MERGE_NODE_INTO_LEFT;
                throw new Error("NO BALANCE CASE found for effectedNode");
            }
        }
    }

    export function find_effective_parent_cell<K>(effectiveNode: BPlusNode<K>): BPlusCell<K> {
        let effective_parent_cell = effectiveNode.parent_cell;
        if (!effective_parent_cell) {
            let currentNode: BPlusNode<K> | undefined = effectiveNode;
            while (currentNode) {
                effective_parent_cell = currentNode.parent_cell;
                if (effective_parent_cell) return effective_parent_cell;
                currentNode = currentNode.parent_node;
            }
            if (
                !effective_parent_cell &&
                effectiveNode.parent_node &&
                effectiveNode.parent_node.cellsList &&
                effectiveNode.parent_node.cellsList.min
            ) {
                return effectiveNode.parent_node.cellsList.min.key;
            } else {
                throw new Error("Not allowed condition");
            }
        } else {
            return effective_parent_cell;
        }
    }

    export function split<K>(
        tree: BPlusTree<K>,
        effectedNode: BPlusNode<K>,
        customCompare: ComparatorFunction<BPlusCell<K>>
    ): BPlusNode<K> {
        // Split cellsList
        const splitAfterIndex = tree.half_capacity;
        const [newLeftList, newRightList] = LL.splitAt<BPlusCell<K>>(effectedNode.cellsList, splitAfterIndex);

        // creating new right node and setting its relationships
        const splitRightNode = createBPlusNode<K>(
            tree,
            effectedNode.isLeaf,
            effectedNode.parent_node,
            newLeftList.max?.key.right_child_node
        );
        setAsCellsList(splitRightNode, newRightList);

        // sibling relations
        splitRightNode.rightSibling = effectedNode.rightSibling;
        if (effectedNode.rightSibling) effectedNode.rightSibling.leftSibling = splitRightNode;
        splitRightNode.leftSibling = effectedNode;
        effectedNode.rightSibling = splitRightNode;

        // root split
        if (effectedNode.isRoot()) {
            const newRootNode = createBPlusNode<K>(tree, false, undefined, effectedNode);
            tree.root_node = newRootNode;
        }

        // definitely have a parent node
        splitRightNode.parent_node = effectedNode.parent_node;

        // parent cell for new right node
        const parentCellForNewRightNode = createBPlusCell<K>(
            newLeftList.max!.key.key,
            splitRightNode,
            effectedNode.parent_node
        );
        LL.insert(effectedNode.parent_node!.cellsList, customCompare, parentCellForNewRightNode);

        // if leaf
        if (effectedNode.isLeaf) {
            if (effectedNode === tree.right_most_node) tree.right_most_node = splitRightNode;
        } else {
            // remove max from left node
            LL.deleteNode(newLeftList, customCompare, createBPlusCell<K>(newLeftList.max!.key.key));
        }
        return effectedNode.parent_node!;
    }

    export function merge<K>(
        tree: BPlusTree<K>,
        source: BPlusNode<K>,
        target: BPlusNode<K>,
        customCompare: ComparatorFunction<BPlusCell<K>>
    ): BPlusNode<K> {
        // 1. Find effective parent cell
        const effective_parent_cell = find_effective_parent_cell(source);

        // 2. handle first cell for target
        if (!source.isLeaf) {
            const right_child_node = source.left_most_child!;
            const first_cell_for_target = createBPlusCell<K>(effective_parent_cell.key, right_child_node, target);
            LL.insert(target.cellsList, customCompare, first_cell_for_target);
        }

        // 3. Merge source cellsList in target
        LL.mergeSplittedRightIntoLeft(target.cellsList, source.cellsList);
        reinforceParentShipInChildNodes(target);

        // 4. Update sibling relations
        target.rightSibling = source.rightSibling;
        if (source.rightSibling) source.rightSibling.leftSibling = target;

        // 5. Remove parent relation of source node
        if (source.isLeftMostNode()) {
            const replacement_key = source.parent_node!.cellsList.min!.key.key;
            const deletedN = LL.deleteNode(
                source.parent_node!.cellsList,
                customCompare,
                createBPlusCell<K>(replacement_key)
            );
            if (deletedN && deletedN.key && deletedN.key.right_child_node)
                setAsLeftMostChildNode(source.parent_node!, deletedN.key.right_child_node);
            effective_parent_cell.key = replacement_key;
        } else {
            LL.deleteNode(
                source.parent_node!.cellsList,
                customCompare,
                createBPlusCell<K>(source.parent_cell!.key)
            );
        }

        if (source === tree.right_most_node) tree.right_most_node = target;

        return source.parent_node!;
    }

    export function distribute<K>(
        tree: BPlusTree<K>,
        source: BPlusNode<K>,
        target: BPlusNode<K>,
        source_is: SOURCE_IS,
        customCompare: ComparatorFunction<BPlusCell<K>>
    ): void {
        // 1. Find effective parent cell
        const effectiveNode = source_is === SOURCE_IS.LEFT_SIBLING ? target : source;
        const effective_parent_cell = find_effective_parent_cell(effectiveNode);

        // 2. handle first cell for target
        if (!source.isLeaf) {
            if (target.cellsList) {
                const right_child_node =
                    source_is === SOURCE_IS.LEFT_SIBLING ? target.left_most_child! : source.left_most_child!;
                const first_cell_for_target = createBPlusCell<K>(
                    effective_parent_cell.key,
                    right_child_node,
                    target
                );
                LL.insert(target.cellsList, customCompare, first_cell_for_target);
            }
        }

        // 3. Split cells from source
        let splitted_cells: [SortedLinkedList<BPlusCell<K>>, SortedLinkedList<BPlusCell<K>>];
        if (!source.isLeaf) {
            if (source_is === SOURCE_IS.RIGHT_SIBLING) {
                splitted_cells = LL.splitAt<BPlusCell<K>>(source.cellsList, source.cellsList.count - tree.half_capacity - 1);
            } else {
                splitted_cells = LL.splitAt<BPlusCell<K>>(source.cellsList, source.cellsList.count - tree.half_capacity + 1);
            }
        } else {
            if (source_is === SOURCE_IS.RIGHT_SIBLING) {
                splitted_cells = LL.splitAt<BPlusCell<K>>(source.cellsList, source.cellsList.count - tree.half_capacity - 1);
            } else {
                splitted_cells = LL.splitAt<BPlusCell<K>>(source.cellsList, tree.half_capacity - 1);
            }
        }

        // 4. Calculate effective_LMC and replacement_key
        let effective_LMC: BPlusNode<K> | undefined;
        let replacement_key: K;
        switch (source_is) {
            case SOURCE_IS.LEFT_SIBLING: {
                const max_cell_in_source_after_split = source.cellsList.max!.key;
                effective_LMC = max_cell_in_source_after_split.right_child_node;
                replacement_key = max_cell_in_source_after_split.key;
                if (!source.isLeaf) {
                    LL.deleteNode(source.cellsList, customCompare, createBPlusCell<K>(max_cell_in_source_after_split.key));
                }
            }
                break;
            case SOURCE_IS.RIGHT_SIBLING:
                setAsCellsList(source, splitted_cells[1]);
                const max_cell_in_left_portion_after_split = splitted_cells[0].max!.key;
                effective_LMC = max_cell_in_left_portion_after_split.right_child_node;
                replacement_key = max_cell_in_left_portion_after_split.key;
                if (!source.isLeaf) {
                    LL.deleteNode(splitted_cells[0], customCompare, createBPlusCell<K>(max_cell_in_left_portion_after_split.key));
                }
                break;
        }

        // 5. Merge split cells
        switch (source_is) {
            case SOURCE_IS.LEFT_SIBLING:
                if (splitted_cells[1].count > 0) {
                    LL.mergeSplittedLeftIntoRight(splitted_cells[1], target.cellsList);
                    reinforceParentShipInChildNodes(target);
                }
                break;
            case SOURCE_IS.RIGHT_SIBLING:
                if (splitted_cells[0].count > 0) {
                    LL.mergeSplittedRightIntoLeft(target.cellsList, splitted_cells[0]);
                    reinforceParentShipInChildNodes(target);
                }
                break;
        }

        // 6. Not leaf: handle right_child_node as LMC
        if (!source.isLeaf) {
            switch (source_is) {
                case SOURCE_IS.LEFT_SIBLING:
                    setAsLeftMostChildNode(target, effective_LMC!);
                    break;
                case SOURCE_IS.RIGHT_SIBLING:
                    setAsLeftMostChildNode(source, effective_LMC!);
                    break;
            }
        }

        // 7. Resetting effective_parent_cell key
        if (source_is === SOURCE_IS.RIGHT_SIBLING && source.isLeaf) {
            effective_parent_cell.key = target.cellsList.max!.key.key;
        } else {
            effective_parent_cell.key = replacement_key;
        }
    }

    export function balance<K>(
        tree: BPlusTree<K>,
        effectedNode: BPlusNode<K>,
        customCompare: ComparatorFunction<BPlusCell<K>>
    ): void {
        try {
            const balanceCase = _determineBalancingCase(tree, effectedNode);
            switch (balanceCase) {
                case BalanceCase.DO_NOTHING:
                    break;
                case BalanceCase.REMOVE_ROOT:
                    tree.root_node = tree.root_node!.left_most_child;
                    if (tree.root_node) tree.root_node.parent_node = undefined;
                    break;
                case BalanceCase.SPLIT: {
                    const nextnode = split<K>(tree, effectedNode, customCompare);
                    balance<K>(tree, nextnode, customCompare);
                }
                    break;
                case BalanceCase.DISTRIBUTE_RIGHT_INTO_NODE:
                    distribute<K>(tree, effectedNode.rightSibling!, effectedNode, SOURCE_IS.RIGHT_SIBLING, customCompare);
                    break;
                case BalanceCase.DISTRIBUTE_LEFT_INTO_NODE:
                    distribute<K>(tree, effectedNode.leftSibling!, effectedNode, SOURCE_IS.LEFT_SIBLING, customCompare);
                    break;
                case BalanceCase.MERGE_RIGHT_INTO_NODE: {
                    const nextnode = merge<K>(tree, effectedNode.rightSibling!, effectedNode, customCompare);
                    if (nextnode) balance<K>(tree, nextnode, customCompare);
                }
                    break;
                case BalanceCase.MERGE_NODE_INTO_LEFT: {
                    const nextnode = merge<K>(tree, effectedNode, effectedNode.leftSibling!, customCompare);
                    if (nextnode) balance<K>(tree, nextnode, customCompare);
                }
                    break;
            }
        } catch (e) {
            throw new Error("Failed while balancing: " + (e instanceof Error ? e.message : ""));
        }
    }

    export function searchForLeafNode<K>(
        tree: BPlusTree<K>,
        compare: ComparatorFunction<BPlusCell<K>>,
        key: K,
        queryCompare?: ComparatorFunction<BPlusCell<K>>
    ): BPlusNode<K> | undefined {
        const effectiveComparator = queryCompare || compare;
        if (!tree.root_node) return undefined;
        let bpNode: BPlusNode<K> | undefined = tree.root_node;
        const searchKey = createBPlusCell<K>(key);
        while (bpNode && !bpNode.isLeaf) {
            const foundCell = LL.search(bpNode.cellsList, effectiveComparator, searchKey, SearchType.LesserThanOrEqualsTo);
            if (!foundCell) {
                bpNode = bpNode.left_most_child;
            } else {
                const c = effectiveComparator(searchKey, foundCell.key);
                if (c === 0) {
                    if (foundCell.leftSibling) bpNode = foundCell.leftSibling.key.right_child_node;
                    else bpNode = bpNode.left_most_child;
                } else {
                    bpNode = foundCell.key.right_child_node;
                }
            }
        }
        return bpNode; // guaranteed leaf or undefined
    }

    export function searchForKey<K>(
        tree: BPlusTree<K>,
        compare: ComparatorFunction<BPlusCell<K>>,
        searchKey: K,
        searchType: SearchType = SearchType.EqualsTo
    ): K | undefined {
        const leafNode = searchForLeafNode(tree, compare, searchKey);
        if (leafNode && leafNode.cellsList) {
            const foundNode = LL.search<BPlusCell<K>>(leafNode.cellsList, compare, createBPlusCell<K>(searchKey), searchType);
            if (foundNode) return foundNode.key.key;
        }
        return undefined;
    }

    export function searchForValue<K>(
        tree: BPlusTree<K>,
        compare: ComparatorFunction<BPlusCell<K>>,
        searchKey: K,
        searchType: SearchType = SearchType.EqualsTo
    ): any {
        const leafNode = searchForLeafNode(tree, compare, searchKey);
        if (leafNode && leafNode.cellsList) {
            const foundNode = LL.search<BPlusCell<K>>(leafNode.cellsList, compare, createBPlusCell<K>(searchKey), searchType);
            if (foundNode) return foundNode.key.value;
        }
        return undefined;
    }

    export function searchForKV<K, V>(
        tree: BPlusTree<K>,
        compare: ComparatorFunction<BPlusCell<K>>,
        searchKey: K,
        searchType: SearchType = SearchType.EqualsTo
    ): BB_KV_P<K, V> | undefined {
        let leafNode = searchForLeafNode(tree, compare, searchKey);
        if (leafNode) {
            const sk = createBPlusCell<K>(searchKey);
            if (leafNode.cellsList) {
                while (leafNode) {
                    const foundLinkedNode = LL.search<BPlusCell<K>>(leafNode.cellsList, compare, sk, searchType);
                    if (foundLinkedNode) {
                        return new BB_KV_P<K, V>(foundLinkedNode.key.key, foundLinkedNode.key.value as V);
                    } else {
                        if (searchType === SearchType.LesserThan) leafNode = leafNode.leftSibling;
                        else if (searchType === SearchType.GreaterThan) leafNode = leafNode.rightSibling;
                        else break;
                    }
                }
            }
        }
        return undefined;
    }

    export function searchForRangeWithPagination<K>(
        tree: BPlusTree<K>,
        compare: ComparatorFunction<BPlusCell<K>>,
        offset: number = 0,
        limit: number = -1,
        startKey?: K,
        endKey?: K
    ): K[] {
        const startNode = !startKey ? tree.left_most_node : searchForLeafNode(tree, compare, startKey);
        const endNode = !endKey ? tree.right_most_node : searchForLeafNode(tree, compare, endKey);
        let currentNode = startNode;

        let skip = 0;
        let count = 0;

        const result: K[] = [];

        if (startNode !== endNode) {
            while (currentNode !== endNode) {
                const sk = !startKey ? undefined : createBPlusCell<K>(startKey as K, undefined, undefined);
                const ek = !endKey ? undefined : createBPlusCell<K>(endKey as K, undefined, undefined);
                if (currentNode && currentNode.cellsList) {
                    const st1 = LL.searchTillStream<BPlusCell<K>>(currentNode.cellsList, compare, sk, ek);
                    for (const n1 of st1) {
                        if (skip >= offset) {
                            if (limit !== -1 && count === limit) break;
                            count++;
                            result.push(n1.key);
                        } else {
                            skip++;
                        }
                    }
                    currentNode = currentNode.rightSibling;
                }
            }
        }
        if (currentNode && currentNode === endNode) {
            const sk = !startKey ? undefined : createBPlusCell<K>(startKey as K, undefined, undefined);
            const ek = !endKey ? undefined : createBPlusCell<K>(endKey as K, undefined, undefined);
            if (currentNode && currentNode.cellsList) {
                const st1 = LL.searchTillStream<BPlusCell<K>>(currentNode.cellsList, compare, sk, ek);
                for (const n1 of st1) {
                    if (skip >= offset) {
                        if (limit !== -1 && count === limit) break;
                        count++;
                        result.push(n1.key);
                    } else {
                        skip++;
                    }
                }
            }
        }

        return result;
    }

    export function searchForRangeWithPaginationV<K>(
        tree: BPlusTree<K>,
        compare: ComparatorFunction<BPlusCell<K>>,
        offset: number = 0,
        limit: number = -1,
        startKey?: K,
        endKey?: K
    ): any[] {
        const startNode = !startKey ? tree.left_most_node : searchForLeafNode(tree, compare, startKey);
        const endNode = !endKey ? tree.right_most_node : searchForLeafNode(tree, compare, endKey);
        let currentNode = startNode;

        let skip = 0;
        let count = 0;

        const result: any[] = [];

        if (startNode !== endNode) {
            while (currentNode !== endNode) {
                const sk = !startKey ? undefined : createBPlusCell<K>(startKey as K, undefined, undefined);
                const ek = !endKey ? undefined : createBPlusCell<K>(endKey as K, undefined, undefined);
                if (currentNode && currentNode.cellsList) {
                    const st1 = LL.searchTillStream<BPlusCell<K>>(currentNode.cellsList, compare, sk, ek);
                    for (const n1 of st1) {
                        if (skip >= offset) {
                            if (limit !== -1 && count === limit) break;
                            count++;
                            result.push(n1.value);
                        } else {
                            skip++;
                        }
                    }
                    currentNode = currentNode.rightSibling;
                }
            }
        }
        if (currentNode && currentNode === endNode) {
            const sk = !startKey ? undefined : createBPlusCell<K>(startKey as K, undefined, undefined);
            const ek = !endKey ? undefined : createBPlusCell<K>(endKey as K, undefined, undefined);
            if (currentNode && currentNode.cellsList) {
                const st1 = LL.searchTillStream<BPlusCell<K>>(currentNode.cellsList, compare, sk, ek);
                for (const n1 of st1) {
                    if (skip >= offset) {
                        if (limit !== -1 && count === limit) break;
                        count++;
                        result.push(n1.value);
                    } else {
                        skip++;
                    }
                }
            }
        }

        return result;
    }

    export function find<K>(
        tree: BPlusTree<K>,
        compare: ComparatorFunction<BPlusCell<K>>,
        queryComparator: ComparatorFunction<BPlusCell<K>>,
        bookmark_key?: K,
        yieldIndividualDuplicates: boolean = false
    ): K[] {
        const result: K[] = [];
        let found_leaf_node: BPlusNode<K> | undefined;
        if (bookmark_key) {
            found_leaf_node = searchForLeafNode(tree, compare, bookmark_key, queryComparator);
        } else {
            if (tree.left_most_node && tree.left_most_node.cellsList && tree.left_most_node.cellsList.count > 0) {
                found_leaf_node = searchForLeafNode(tree, compare, tree.left_most_node.cellsList.min!.key.key, queryComparator);
            }
        }
        let findingMatches = true;
        while (findingMatches) {
            if (!found_leaf_node) {
                findingMatches = false;
                break;
            }
            let startKey: BPlusCell<K> | undefined;
            if (bookmark_key) {
                startKey = createBPlusCell<K>(bookmark_key, undefined, found_leaf_node);
            } else {
                if (found_leaf_node && found_leaf_node.cellsList && found_leaf_node.cellsList.min) {
                    startKey = found_leaf_node.cellsList.min.key;
                }
            }
            if (found_leaf_node && found_leaf_node.cellsList) {
                const avlStr = LL.find<BPlusCell<K>>(found_leaf_node.cellsList, queryComparator);
                for (const avlnode of avlStr) {
                    if (bookmark_key) {
                        bookmark_key = undefined;
                        continue;
                    }
                    const searchKeyCurrentNode = queryComparator(createBPlusCell(avlnode.key), createBPlusCell(avlnode.key));
                    if (searchKeyCurrentNode === 0) {
                        result.push(avlnode.key);
                    }
                }
                found_leaf_node = found_leaf_node.rightSibling;
            }
        }
        return result;
    }

    export function findV<K>(
        tree: BPlusTree<K>,
        compare: ComparatorFunction<BPlusCell<K>>,
        queryComparator: ComparatorFunction<K>,
        bookmark_key?: K,
        yieldIndividualDuplicates: boolean = false,
        limit: number = 0
    ): any[] {
        const result: any[] = [];
        const ec: ComparatorFunction<BPlusCell<K>> = (c1, c2) => {
            return queryComparator(c1.key, c2.key);
        };
        let found_leaf_node: BPlusNode<K> | undefined;
        if (bookmark_key) {
            found_leaf_node = searchForLeafNode(tree, compare, bookmark_key, ec);
        } else {
            if (tree.left_most_node && tree.left_most_node.cellsList && tree.left_most_node.cellsList.count > 0) {
                found_leaf_node = searchForLeafNode(tree, compare, tree.left_most_node.cellsList.min!.key.key, ec);
            }
        }
        let findingMatches = true;
        while (findingMatches) {
            if (!found_leaf_node) {
                findingMatches = false;
                break;
            }
            let startKey: BPlusCell<K> | undefined;
            if (bookmark_key) {
                startKey = createBPlusCell<K>(bookmark_key, undefined, found_leaf_node);
            } else {
                if (found_leaf_node && found_leaf_node.cellsList && found_leaf_node.cellsList.min) {
                    startKey = found_leaf_node.cellsList.min.key;
                }
            }
            if (found_leaf_node && found_leaf_node.cellsList) {
                const avlStr = LL.find<BPlusCell<K>>(found_leaf_node.cellsList, ec);
                for (const avlnode of avlStr) {
                    if (bookmark_key) {
                        bookmark_key = undefined;
                        continue;
                    }
                    const searchKeyCurrentNode = queryComparator(avlnode.key, avlnode.key);
                    if (searchKeyCurrentNode === 0) {
                        result.push(avlnode.value);
                        if (result.length === limit) break;
                    }
                }
                found_leaf_node = found_leaf_node.rightSibling;
            }
        }
        return result;
    }

    export function insert<K>(
        tree: BPlusTree<K>,
        compare: ComparatorFunction<BPlusCell<K>>,
        key: K,
        value?: any
    ): K | undefined {
        if (!tree.root_node) {
            tree.root_node = createBPlusNode(tree, true);
            tree.left_most_node = tree.root_node;
            tree.right_most_node = tree.root_node;
            tree.size++;
            const j = LL.insert<BPlusCell<K>>(tree.root_node.cellsList, compare, createBPlusCell<K>(key, undefined, tree.root_node));
            j.key.value = value;
            return key;
        }
        const leafNode = searchForLeafNode(tree, compare, key);
        if (leafNode) {
            const insertedNode = LL.insert<BPlusCell<K>>(leafNode.cellsList, compare, createBPlusCell<K>(key, undefined, leafNode));
            insertedNode.key.value = value;
            balance<K>(tree, leafNode, compare);
            tree.size++;
            return key;
        }
        return undefined;
    }

    export function deleteKey<K>(
        tree: BPlusTree<K>,
        compare: ComparatorFunction<BPlusCell<K>>,
        key: K
    ): K | undefined {
        if (!tree.root_node) {
            tree.size = 0;
            return undefined;
        } else {
            const leafNode = searchForLeafNode(tree, compare, key);
            const deletedNode = LL.deleteNode(leafNode!.cellsList, compare, createBPlusCell<K>(key));
            if (deletedNode) {
                tree.size -= (1 + deletedNode.duplicate_count);
                balance(tree, leafNode!, compare);
                return deletedNode.key.key;
            }
        }
        return undefined;
    }

    export function deleteKeyReturnValue<K>(
        tree: BPlusTree<K>,
        compare: ComparatorFunction<BPlusCell<K>>,
        key: K
    ): any {
        if (!tree.root_node) {
            tree.size = 0;
            return undefined;
        } else {
            const leafNode = searchForLeafNode(tree, compare, key);
            const deletedNode = LL.deleteNode(leafNode!.cellsList, compare, createBPlusCell<K>(key));
            if (deletedNode) {
                tree.size -= (1 + deletedNode.duplicate_count);
                balance(tree, leafNode!, compare);
                return deletedNode.key.value;
            }
        }
        return undefined;
    }

    export function getSize<K>(tree: BPlusTree<K>): number {
        return tree.size;
    }

    export function getMiddleKey<K>(tree: BPlusTree<K>): K | undefined {
        let found_leaf_node = tree.left_most_node;
        const hs = Math.floor(getSize(tree) / 2);
        let c = 0;
        if (!found_leaf_node) return undefined;
        while (c < hs && found_leaf_node) {
            const t = c + found_leaf_node.cellsList.count;
            if (t < hs) found_leaf_node = found_leaf_node.rightSibling;
            else return found_leaf_node.cellsList.min!.key.key;
            c = t;
        }
        return undefined;
    }

    export function searchForRangeWithPaginationKVP<K, V>(
        tree: BPlusTree<K>,
        compare: ComparatorFunction<BPlusCell<K>>,
        offset: number = 0,
        limit: number = -1,
        startKey?: K,
        endKey?: K
    ): BB_KV_P<K, V>[] {
        const startNode = !startKey ? tree.left_most_node : searchForLeafNode(tree, compare, startKey);
        const endNode = !endKey ? tree.right_most_node : searchForLeafNode(tree, compare, endKey);
        let currentNode = startNode;

        let skip = 0;
        let count = 0;

        const result: BB_KV_P<K, V>[] = [];

        if (startNode !== endNode) {
            while (currentNode !== endNode) {
                const sk = !startKey ? undefined : createBPlusCell<K>(startKey as K, undefined, undefined);
                const ek = !endKey ? undefined : createBPlusCell<K>(endKey as K, undefined, undefined);
                if (currentNode && currentNode.cellsList) {
                    const st1 = LL.searchTillStream<BPlusCell<K>>(currentNode.cellsList, compare, sk, ek);
                    for (const n1 of st1) {
                        if (skip >= offset) {
                            if (limit !== -1 && count === limit) break;
                            count++;
                            const kvp = new BB_KV_P<K, V>(n1.key, n1.value as V);
                            result.push(kvp);
                        } else {
                            skip++;
                        }
                    }
                    currentNode = currentNode.rightSibling;
                }
            }
        }
        if (currentNode && currentNode === endNode) {
            const sk = !startKey ? undefined : createBPlusCell<K>(startKey as K, undefined, undefined);
            const ek = !endKey ? undefined : createBPlusCell<K>(endKey as K, undefined, undefined);
            if (currentNode && currentNode.cellsList) {
                const st1 = LL.searchTillStream<BPlusCell<K>>(currentNode.cellsList, compare, sk, ek);
                for (const n1 of st1) {
                    if (skip >= offset) {
                        if (limit !== -1 && count === limit) break;
                        count++;
                        const kvp = new BB_KV_P<K, V>(n1.key, n1.value as V);
                        result.push(kvp);
                    } else {
                        skip++;
                    }
                }
            }
        }

        return result;
    }
}