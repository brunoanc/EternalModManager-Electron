// Type declaration for drag-drop module
declare module 'drag-drop' {
    function dragDrop(elem: string | HTMLElement, listeners: any): () => void;
    export = dragDrop;
}
