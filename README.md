# JOIA

JOIA stands for Javascript Object Indirect Addressing.

The key idea behind JOIA is simple yet powerful.

In Lua, Lisp, and many other dynamic languages, all or some objects are stored as hash table for string-based access.

JOIA pushes this ingenius idea to a higher level. 

JOIA use a global hash table to store the Indirect Address for each child object (members) inside a parent object. There is a global hash scheme. As long as the function get the object reference, and the property name, it can quickly figure out the Indirect Address of the child object, and fetch its reference (Physical Address) from the Indirect Addressing Table.

Further more, two other optimization is also added. 

The first one is all Property strings are stored in a Property String Table, together with it's HASH value. This is something like the widely used string intern in many dynamic languages, such as lua or python. But the purpose here is different. String intern is intended for saving space, or may save time if comparing the string. Here, we construct this table for shorten the HASH value calculation time.

The second one is to use 'pointer to pointer' to access object. This have some negative impact on performance but in this way, we can move object memory to eliminate the fragmentation problem.

# Core Data Struct

This is not the final code. Just an illustration on concepts. Since there are no code at all now.

### Property String Table

Each entry in this table stores a Property String, as well as its HASH string. A reference count may also be needed but it's off-topic.

This table is accessed by index or by pointer.

This table can be implemented by tree or hash table. The latter is prefered for simplicity and code reuse.

### Object Handle Table

We use Object Hander to stand for the pointer to object. All objects are created on heap, and store its pointer in this table. In function, all objects are passed by Object Handler rather than object pointer. 

Accessing by id is OK.

### Object

Object is a table. Each entry stores two info. One is the reference to the Property String in Property String Table, the other is the Indirect Address of the property object. Store Indirect Address rather than Handle is because when the property is deleted, the coresponding Indirect Address table entry should be recycled.

### Indirect Address Table

Each entry in this table stores a Object Handle, or NULL if the slot is empty.

# Indirect Address Calculation

Supposing the Object A's handle is h_a; The property name is a constant string literal or a dynamic string str; the Indirect Address is:

HASH(h_a, str);

h_a is included because at run time, all object instance have the same property name. We should add the uniqueness of the object to this addressing scheme. Object Handle is unique and random (almost), well suited for this job.

The function can use this address to fetch the corresponding (sub) object handle in Indirect Addressing Table.

There should be a new string Struct other than traditional null-terminated C string. It can either holds a reference to an entry in Property String table, or a C string dynamically computed.

All Property String in source code should be computed in compile time, and store there value into Property Name Table.

The standard Java String string object should be hacked to have a field as HASH value. This is useful if the string used as dynamic Property Name. It's calculation is lazy, only when it is used as Property Name.

But it is not needed to store this string in Property Name Table instantly. Only when a Property is created, a lookup should be performed and a new string should be added. 

When the String is modified. The hash value should be cleared.

