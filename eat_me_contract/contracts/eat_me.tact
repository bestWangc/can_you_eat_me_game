import "@stdlib/deploy";
import "../jetton";

contract EatMe with Jetton {
    total_supply: Int;
    mintable: Bool;
    owner: Address;
    content: Cell;

    max_supply: Int as coins;

    init(owner: Address, content: Cell, max_supply: Int) {
        self.total_supply = 0;
        self.owner = owner;
        self.mintable = true;
        self.content = content;
        self.max_supply = max_supply;
    }
}
