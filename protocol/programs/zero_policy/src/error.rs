use anchor_lang::prelude::*;

#[error_code]
pub enum ZeroError {
    #[msg("Policy is paused")]
    Paused,
    #[msg("Recipient is not on the policy allowlist")]
    RecipientNotAllowed,
    #[msg("Amount exceeds the policy's max payment")]
    AmountExceedsMaxPayment,
    #[msg("Payment would exceed the policy's daily limit")]
    DailyLimitExceeded,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Allowlist is full")]
    AllowlistFull,
    #[msg("Provider is already on the allowlist")]
    DuplicateProvider,
    #[msg("Signer is not authorized for this policy")]
    Unauthorized,
    #[msg("Arithmetic overflow")]
    MathOverflow,
    #[msg("Provider is not on the allowlist")]
    ProviderNotFound,
    #[msg("Limits must be non-zero and max_per_payment must not exceed daily_limit")]
    InvalidLimits,
    #[msg("Mint uses a Token-2022 extension this program does not support")]
    UnsupportedMint,
}
