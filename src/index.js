/**
 * Return a descriptor removing the value and returning a getter
 * The getter will return a .bind version of the function
 * and memoize the result against a symbol on the instance
 */
export function boundMethod(target, key, descriptor) {
	let fn = descriptor.value;

	if (typeof fn !== 'function') {
		throw new TypeError(`@boundMethod decorator can only be applied to methods not: ${typeof fn}`);
	}

	// In IE11 calling Object.defineProperty has a side-effect of evaluating the
	// getter for the property which is being replaced. This causes infinite
	// recursion and an "Out of stack space" error.
	let definingProperty = false;

	return {
		configurable: true,
		get() {
			// eslint-disable-next-line no-prototype-builtins
			if (definingProperty || this === target.prototype || this.hasOwnProperty(key) || typeof fn !== 'function') {
				return fn;
			}
			// 这个 this 即为子类 Hello
			const boundFn = fn.bind(this);
			definingProperty = true;
			// 这个操作是把 method 定义到子类上 感觉没有什么必要
			// 暂时不太清楚作者为什么这么做
			// 可能是因为箭头函数的是把 methods 定义在子类上 所以也做了这个事情 应该是可以去掉
			// can be removed 亲测可用
			Object.defineProperty(this, key, {
				configurable: true,
				get() {
					return boundFn;
				},
				set(value) {
					fn = value;
					delete this[key];
				}
			});
			// can be removed
			definingProperty = false;
			return boundFn;
		},
		set(value) {
			fn = value;
		}
	};
}

/**
 * Use boundMethod to bind all methods on the target.prototype
 */
export function boundClass(target) {
	// (Using reflect to get all keys including symbols)
	let keys;
	// Use Reflect if exists
	if (typeof Reflect !== 'undefined' && typeof Reflect.ownKeys === 'function') {
		// 这里只会取出在原型上的 methods
		keys = Reflect.ownKeys(target.prototype);
	} else {
		keys = Object.getOwnPropertyNames(target.prototype);
		// Use symbols if support is provided
		if (typeof Object.getOwnPropertySymbols === 'function') {
			keys = keys.concat(Object.getOwnPropertySymbols(target.prototype));
		}
	}

	keys.forEach(key => {
		// Ignore special case target method
		// 这里有个问题, render 也不需要 bind this, render 是存在原型链中的, 所以 this.render 是一定会有的
		// 同时 render 也是 class 中的一个方法, 会被 Reflect.ownKeys 枚举出来
		// 然后在 boundMethod 中在子类上添加一个同名的方法 render 和 get render, set render
		// 这个是没有必要的, 所以可以把这个 key 去掉
		// 这里作者没有去掉的原因可能是 这个并不针对于 react
		// if (key === 'constructor' || key === 'render') {
		if (key === 'constructor') {
			return;
		}
		
		const descriptor = Object.getOwnPropertyDescriptor(target.prototype, key);
		
		// Only methods need binding
		// 还有就是这里 这里把经过 bind(this) 的方法 定义到原型上
		// 而 methods 本来就是应该在子类上的 把 methods 定义到原型上是否合适
		// 不用箭头函数的方法就是在原型上的
		// 而用了箭头函数的方法会绑定当前作用域
		if (typeof descriptor.value === 'function') {
			Object.defineProperty(target.prototype, key, boundMethod(target, key, descriptor));
		}
	});
	return target;
}

export default function autobind(...args) {
	// bind class: args is only one that is the target class
	if (args.length === 1) {
		return boundClass(...args);
	}
	// bind method: args are three: [Component, method name, method property]
	return boundMethod(...args);
}

/* 

class Hello extends React.Component {
	constructor() {
		super();
		// 以往的这样的写法是把 Hello 原型上的 handleClick 方法 拷贝了一份放在 Hello 中
		this.handleClick = this.handleClick.bind(this);
	}
	// 这个属性是存在于原型上的 即 Hello.prototype
	handleClick(e) {
	  console.log(this, e);
	}
	// 这个属性是存在于子类上的 即 Hello
	click2 = (e) => {
		console.log(this, e);
	}
	render() {
	  	return (
			<div> Hello {this.props.name}
				// 这里的 onClick={this.handleClick} 把 button 上绑定了当前作用域上的 handleClick 回调
				// 但是当前作用域上的这个函数 并没有绑定这个实例 即 this(这里说实例是因为 new 之后才有 this)
				<button onClick={this.handleClick}>click me!</button>
				<button onClick={this.click2}>click me2!</button>
			</div>
		);
	}
}

ReactDOM.render(
  <Hello name="World" />,
  document.getElementById('container')
);

在正常情况下
class Animal {
    constructor(theName) { this.name = theName; }
    heihei = () => {
        console.log(456);
    }
}

class Snake extends Animal {
    constructor(name) { super(name); }
    move(distanceInMeters = 5) {
        console.log(this);
    }
    haha = () => {
        console.log(this);
    }
}
const snake = new Snake('xxx');
snake.haha();
snake.move();
是都是会返回正确的 this 的
const haha = snake.haha;
// 这种是绑定 this 的方法 在哪里调用 this 都指向 snake 实例 不管你使用 bind call apply 都不能改变其 this
haha();
// Snake {heihei: ƒ, name: "xxx", haha: ƒ}

const move = snake.move;
// 不绑定 this 的方法 会找不到 this 可以使用 bind call apply 改变其 this
move();
// undefined


至于 md 中的示例
class Component {
  constructor(value) {
    this.value = value
  }

  @boundMethod
  method() {
    return this.value
  }
}

let component = new Component(42)
let method = component.method // .bind(component) isn't needed!
method() // returns 42

保证方法调用时候的上下文 这种用法似乎不多
一般都会在调用的时候 call apply

*/
