pub mod sum;
use bytes_helper::bn_to_field;
use bytes_helper::field_to_bn;
use halo2curves::bn256::Fr as BabyJubjubFq;
use num_bigint::BigUint;
use std::ops::AddAssign;
use std::ops::Shl;

const LIMBSZ: usize = 64;
const LIMBNB: usize = 4;

use crate::jubjub;
pub fn fetch_fq(limbs: &Vec<u64>, index: usize) -> BabyJubjubFq {
    let mut bn = BigUint::ZERO;
    for i in 0..LIMBNB {
        bn.add_assign(BigUint::from(limbs[index * LIMBNB + i]) << (i * LIMBSZ))
    }
    bn_to_field(&bn)
}

fn fetch_g1(limbs: &Vec<u64>) -> jubjub::Point {
    jubjub::Point {
        x: fetch_fq(limbs, 0),
        y: fetch_fq(limbs, 1),
    }
}

pub fn babyjubjub_fq_to_limbs(result_limbs: &mut Vec<u64>, f: BabyJubjubFq) {
    let mut bn = field_to_bn(&f);
    for _ in 0..LIMBNB {
        let d: BigUint = BigUint::from(1 as u64).shl(LIMBSZ);
        let r = bn.clone() % d.clone();
        let value = if r == BigUint::from(0 as u32) {
            0 as u64
        } else {
            r.to_u64_digits()[0]
        };
        bn = bn / d;
        result_limbs.append(&mut vec![value]);
    }
}
