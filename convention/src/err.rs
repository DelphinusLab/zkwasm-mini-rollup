pub trait ErrorEncoder {
    const MODULE_ID: u32;
    const ERROR_STR: &'static [&'static str];
    fn encode(e: u32) -> u32 {
        e | (Self::MODULE_ID << 16)
    }
    fn decode(e: u32) -> Option<&'static str> {
        let mid = e >> 16;
        if mid == Self::MODULE_ID {
            Some(Self::ERROR_STR[(e & 0xffff) as usize])
        } else {
            None
        }
    }
}
