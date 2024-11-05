import "@stdlib/deploy";
import "../jetton";

contract EatMe with Jetton {
    total_supply: Int;
    mintable: Bool;
    owner: Address;
    content: Cell;
}
