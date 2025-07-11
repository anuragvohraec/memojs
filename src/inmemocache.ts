import {BPlusTree, BB, BPlusCell} from "./btree";

const comparator =(k1:BPlusCell<IDBValidKey>, k2:BPlusCell<IDBValidKey>)=>{
    return indexedDB.cmp(k1.key, k2.key);
}

export class InMemoCache{
    private btree: BPlusTree<IDBValidKey>;

    constructor(node_size:number){
        this.btree = new BPlusTree<IDBValidKey>(node_size);
    }

    put(key:IDBValidKey,value: any){
        BB.insert(this.btree,comparator,key,value);
    }

    get(key:IDBValidKey){
        return BB.searchForValue(this.btree,comparator,key);
    }

    delete(key:IDBValidKey){
        return BB.deleteKeyReturnValue(this.btree,comparator,key);
    }

    get size(){
        return this.btree.size;
    }

    from({start,end}:{start?:IDBValidKey, end?:IDBValidKey}){
        const cursor={
            start,end,current: start,isEnded:false,
            next:()=>{
                if(!cursor.isEnded){
                    const o = BB.searchForRangeWithPaginationKVP(this.btree,comparator,0,2,cursor.current,end);
                    const s = o.length;
                    if(s>0){
                        const t = o[0];
                        const j = t.value;

                        if(s>1){
                            const nextKey = o[1];
                            cursor.current = nextKey.key;
                        }else{
                            cursor.isEnded = true;
                        }

                        return j;
                    }
                }
            }
        }

        const source = {
            pull:(controller: ReadableStreamDefaultController<any>)=>{
                const nextValue = cursor.next();

                if(nextValue){
                    controller.close();
                }else{
                    controller.enqueue(nextValue);
                }
            }
        }
        
        return new ReadableStream(source);
    }

}