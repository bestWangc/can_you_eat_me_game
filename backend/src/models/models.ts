export interface Buff {
  id: number;
  desc: string;
  type: number;
  time: number;
  value: string;
  probability: number;
  status: boolean;
  create_time: number;
  update_time: number | null;
}

export interface Configs {
  id: number;
  unique_key: string;
  name: string;
  value: string;
  status: boolean;
  create_time: number;
  update_time: number | null;
}

export interface Fruit {
  id: number;
  fruit_id: number;
  status: boolean;
  name: string;
  quality: number;
  attack: number;
  attack_speed: number;
  desc: string;
  little_desc: string;
  baojilv: number;
  baoji: number;
  unlock: number;
  grid_index: number;
  create_time: number;
  update_time: number | null;
}

export interface FruitLevelUp {
  id: number;
  fruit_id: number;
  level: number;
  add_attack: number;
  add_atk_speed: number;
  up_cost_gold: number;
  up_cost_piece: number;
  create_time: number;
  update_time: number | null;
}

export interface Levels {
  id: number;
  name: string;
  level_award: string;
  wave_ids: string;
  award_wave_id: string;
  silver_coin: number;
  award_box_1: string;
  award_box_2: string;
  award_box_3: string;
  pic: number;
  create_time: number;
  update_time: number | null;
}

export interface Logs {
  id: number;
  action: string;
  memo: string;
  create_time: number;
}

export interface Monster {
  id: number;
  name: string;
  desc: string;
  img: string;
  blood: number;
  speed: number;
  exp: number;
  is_boss: boolean;
  type: number;
  resistance: number;
  create_time: number;
  update_time: number | null;
}

export interface Talent {
  id: number;
  fruit_id: number;
  desc: string;
  quality: number;
  buff_id: number;
  unlock: number;
  status: boolean;
  create_time: number;
  update_time: number | null;
}

export interface UserFruit {
  id: number;
  fruit_id: number;
  user_id: number;
  fruit_piece: number;
  fruit_level: number;
  attack: number;
  atk_speed: number;
  baoji: number;
  baojilv: number;
  status: boolean;
  create_time: number;
  update_time: number | null;
}

export interface Users {
  id: number;
  telegram_id: bigint;
  address: string;
  username: string;
  avatar: string | null;
  level_id: number;
  gold_amount: bigint;
  diamond_amount: bigint;
  buy_usdt: bigint;
  last_sign_time: number | null;
  sign_day: number | null;
  last_get_free_gold_time: number | null;
  last_getfree_diamond_time: number | null;
  status: boolean;
  invite_code: string | null;
  referred_by: string | null;
  invite_number: number | null;
  create_time: number;
  update_time: number | null;
}

export interface Wave {
  id: number;
  name: string;
  monster_id: string;
  blood_multiply: number;
  create_time: number;
  update_time: number | null;
}

export interface Shop {
  id: number;
  store_id: number;
  fruit_id: number;
  fruit_name: string;
  fragments: number;
  diamonds: bigint;
  create_time: number;
  update_time: Date | null;
}

export interface Knapsack {
  id: number;
  user_id: number;
  fruit_id: number | null;
  quality: number;
  fragments: number;
  status: boolean;
  create_time: number;
  update_time: Date | null;
}

export interface Fight {
  id: number;
  user_id: number;
  level_id: number;
  cost_gold: number;
  create_time: number;
  update_time: Date | null;
}

export interface usersToken {
  uid: number;
  telegram_id: string;
  address: string;
  iat:number;
  exp:number;
}
