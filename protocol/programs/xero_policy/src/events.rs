use anchor_lang::prelude::*;

#[event]
pub struct PaymentSettled {
    pub policy: Pubkey,
    pub spender: Pubkey,
    /// Provider wallet (owner of the recipient token account).
    pub recipient: Pubkey,
    pub amount: u64,
    pub spent_in_window: u64,
}
