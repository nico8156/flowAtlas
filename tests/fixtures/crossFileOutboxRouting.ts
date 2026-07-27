export interface LikeWlGateway {
  add(): Promise<void>;
}

export interface CommentsGateway {
  create(): Promise<void>;
}

export type OutboxCommand = { kind: "Like.Add" } | { kind: "Comment.Create" };

export type Gateways = {
  likes: LikeWlGateway;
  comments: CommentsGateway;
};

export function getGateway(gateways: Gateways, kind: OutboxCommand["kind"]) {
  switch (kind) {
    case "Like.Add":
      return gateways.likes;
    case "Comment.Create":
      return gateways.comments;
  }
}

const hasAdd = (gateway: object): gateway is LikeWlGateway => "add" in gateway;
const hasCreate = (gateway: object): gateway is CommentsGateway => "create" in gateway;

export async function sendCommand(input: {
  command: OutboxCommand;
  gateway: object;
}): Promise<void> {
  switch (input.command.kind) {
    case "Like.Add":
      if (hasAdd(input.gateway)) await input.gateway.add();
      return;
    case "Comment.Create":
      if (hasCreate(input.gateway)) await input.gateway.create();
      return;
  }
}
