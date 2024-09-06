"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statusUpdateService = void 0;
const statusUpdates = new Map();
exports.statusUpdateService = {
    postUpdate(status) {
        const id = Math.floor(Math.random() * 1000000);
        statusUpdates.set(id, status);
        console.log(`Posted new status update with id ${id}`);
        return id;
    },
    destoryUpdate(id) {
        statusUpdates.delete(id);
        console.log(`Destoryed status update with id ${id}`);
    },
};
function createPostStatusCommand(service, status) {
    let postId = null;
    return {
        run() {
            postId = service.postUpdate(status);
        },
        undo() {
            if (postId) {
                service.destoryUpdate(postId);
                postId = null;
            }
        },
        serialize() {
            return {
                type: "post",
                status,
                action: "post",
            };
        },
    };
}
